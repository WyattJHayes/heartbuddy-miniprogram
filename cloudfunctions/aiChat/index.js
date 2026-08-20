// cloudfunctions/aiChat/index.js —— 核心云函数：AI 对话 + 情绪识别 + 危机预警
const cloud = require('wx-server-sdk');
const https = require('https');
const { SYSTEM_PROMPT } = require('./prompt');
const { apiKey, baseUrl, model, temperature, maxTokens, enabled } = require('./config');
const danger = require('./danger');
const secure = require('./secure');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ---------- 调用大模型（OpenAI 兼容接口） ----------
function callLLM(messages) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(baseUrl); } catch (e) { return reject(new Error('非法的 baseUrl')); }
    const body = JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    });

    const req = https.request(
      {
        hostname: url.hostname,
        method: 'POST',
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        timeout: 30000
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve((json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '');
          } catch (e) {
            reject(new Error('LLM 返回解析失败：' + data.slice(0, 200)));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('LLM 请求超时')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------- 解析回复：剥离 JSON 标记，识别危机 ----------
function parseReply(raw) {
  // 模型可能整段返回 JSON，或正文+末尾 JSON
  const crisis = { flag: false, level: 'mid', brief: '' };
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  let content = raw;

  if (jsonMatch) {
    try {
      const j = JSON.parse(jsonMatch[0]);
      if (j.crisis) { crisis.flag = true; crisis.level = j.level || 'mid'; crisis.brief = j.brief || ''; }
      if (typeof j.reply === 'string') content = j.reply;
      else if (j.content) content = String(j.content);
      else content = raw.replace(jsonMatch[0], '').trim() || '我在这里，陪着你。';
    } catch (e) { /* 保留 raw */ }
  }

  // 兜底关键词检测（考虑模型偶尔漏标）
  const dangerWords = ['自杀', '自残', '活不下去', '不想活了', '想死', '结束生命', '伤害自己', '跳楼', '割腕'];
  if (!crisis.flag && dangerWords.some((w) => raw.includes(w))) {
    crisis.flag = true; crisis.level = 'high'; crisis.brief = '对话中出现自杀/自伤高危用词';
  }

  return { content, crisis };
}

// ---------- 简单情绪标签（提示词不返回时兜底） ----------
function guessMood(text) {
  if (/焦虑|紧张|慌|压力|睡不着|失眠/.test(text)) return { mood: 'anxiety', intensity: 0.7 };
  if (/难过|哭|委屈|失落|伤心|抑郁|泪/.test(text)) return { mood: 'sad', intensity: 0.7 };
  if (/生气|愤怒|烦死|恨|火大/.test(text)) return { mood: 'angry', intensity: 0.6 };
  if (/孤独|没人|一个人|寂寞/.test(text)) return { mood: 'lonely', intensity: 0.7 };
  if (/开心|高兴|棒|太好了|轻松/.test(text)) return { mood: 'happy', intensity: 0.5 };
  return { mood: 'peace', intensity: 0.4 };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { sessionId = '', userInput = '', history = [], moodTag = '', assessment = null } = event;

  if (!userInput || !userInput.trim()) return { ok: false, error: 'empty' };
  if (!enabled) return { ok: false, error: 'LLM 未启用，请检查 config.js / 环境变量' };

  // 0. 微信官方内容安全（上架硬要求）：命中违规直接拦下，不进大模型（未开通时自动降级放行）
  const sec = await secure.check({ content: userInput, openid: OPENID });
  if (sec.risky) {
    return {
      code: 0,
      result: {
        content: secure.BLOCKED_REPLY,
        mood: 'peace', intensity: 0.3,
        crisis: null,
        securityBlocked: true
      }
    };
  }

  // 1. 组装多轮上下文（最近 10 条）
  const messages = [];
  // 1.0 语言自适应：输入以英文为主（且无中文）→ 让模型用英文回复（中英文自动跟随）
  const latinCount = (userInput.match(/[A-Za-z]/g) || []).length;
  const cjkCount = (userInput.match(/[\u4e00-\u9fff]/g) || []).length;
  const isEnglish = latinCount >= 4 && cjkCount === 0;
  if (isEnglish) {
    messages.push({
      role: 'system',
      content: 'The user is writing in English. Please continue answering in English, keeping the same warm, caring, non-judgmental tone (switch back to Chinese if the user writes Chinese).'
    });
  }
  if (SYSTEM_PROMPT) messages.push({ role: 'system', content: SYSTEM_PROMPT });
  // 1.1 自评结果作为上下文（自然关心，不下诊断）
  if (assessment && Number.isFinite(assessment.total)) {
    messages.push({
      role: 'system',
      content: `（背景：用户最近做过一次考前焦虑自评，得分 ${assessment.total}/21，等级「${assessment.label || '未知'}」。请在聊天中自然地关心这一方向，但不要下诊断、不贴标签、不透露测评数字给用户。）`
    });
  }
  (Array.isArray(history) ? history.slice(-10) : []).forEach((m) => {
    if (m && m.role && m.content) messages.push({ role: m.role, content: String(m.content).slice(0, 2000) });
  });
  messages.push({ role: 'user', content: userInput });
  if (moodTag) messages.push({ role: 'user', content: `（此刻用户给自己标记的情绪：${moodTag}）` });

  // 2. 调用模型
  let raw = '';
  try {
    raw = await callLLM(messages);
  } catch (err) {
    // 模型挂了也要给用户一个温暖的兜底
    return { code: 0, result: { content: '刚才我走神了，再来一遍好吗？慢慢说，我都在。', mood: 'peace', intensity: 0.3, crisis: null } };
  }

  // 3. 解析 + 本地二级校验（LLM 为主，规则兜底分级）
  const { content, crisis } = parseReply(raw);
  const guess = guessMood(userInput);
  const localRisk = danger.analyze(userInput);
  const final = {
    level: '',
    brief: ''
  };
  if (crisis.flag) {
    final.level = crisis.level === 'high' ? 'high' : localRisk.level === 'high' ? 'high' : 'mid';
    final.brief = crisis.brief || localRisk.keywords.join('、');
  } else if (localRisk.level) {
    final.level = localRisk.level;
    final.brief = localRisk.keywords.join('、');
  }
  const hasCrisis = !!final.level;

  // 4. 危机落库（独立成表，便于运营跟进）
  if (hasCrisis) {
    try {
      await db.collection('crisisAlerts').add({
        data: {
          openid: OPENID,
          source: 'chat',
          level: final.level,
          keywords: final.brief,
          aiSummary: final.brief,
          action: final.level === 'high' ? '已触发求助页' : '已提示求助入口',
          status: 'open',
          createdAt: Date.now()
        }
      });
    } catch (e) { console.error('crisis 落库失败', e); }
  }

  // 5. 情绪记录（脱敏：只存标签与强度，不存对话全文）
  try {
    await db.collection('moods').add({
      data: {
        openid: OPENID,
        sessionId: sessionId || String(Date.now()),
        mood: 'peace',        // 由提示词返回后在此解析；当前为演示简版
        intensity: guess.intensity,
        trigger: guess.mood,
        createdAt: Date.now()
      }
    });
  } catch (e) { console.error('[mood] 落库失败', e); }

  // 6. 更新活跃时间
  try {
    await db.collection('users').where({ openid: OPENID }).update({ data: { lastChatAt: Date.now() } });
  } catch (e) { /* 忽略 */ }

  // 分级提示文案
  const TIPS = {
    high: '如果这一刻很难熬，请一定伸手向身边的人求助，或拨打心理援助热线。',
    mid: '听起来这一阵子确实不容易，需要的话，这里有一些能立刻帮到你的方式。',
    low: '每个人都会有低落的时刻，慢慢来，我在这里陪着你。'
  };

  return {
    code: 0,
    result: {
      content,
      mood: guess.mood,
      intensity: guess.intensity,
      crisis: hasCrisis
        ? { level: final.level, keywords: final.brief, tip: TIPS[final.level] || TIPS.low }
        : null
    }
  };
};