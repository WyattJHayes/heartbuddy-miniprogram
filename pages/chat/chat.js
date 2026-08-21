// pages/chat/chat.js —— 核心对话页
const app = getApp();
const api = require('../../utils/api');
const { quickReplies } = require('../../config/index');
const { MOOD_META, MOOD_SCORE } = require('../../utils/moodscore');
const planlib = require('../../utils/plan');

// 中文情绪标签 → 落库 key（与心情页保持一致）
const MOOD_KEY = { '开心': 'happy', '平静': 'peace', '焦虑': 'anxiety', '难过': 'sad', '孤独': 'lonely', '生气': 'angry' };

// AI 头像情绪态：随当前情绪标签切换的小表情（''=默认🌱）
const AI_FACE = { '开心': '😄', '平静': '😌', '焦虑': '😟', '难过': '😢', '孤独': '🥺', '生气': '😠' };

const GREETINGS = {
  morning: '早上好呀 ☀️ 今天想聊点什么？',
  afternoon: '下午好 🌤 我在这儿陪着你。',
  evening: '夜深了 🌙 有什么想说给我听吗？',
  night: '这么晚还没睡呀 🌙 辛苦了。不用硬撑，想到什么都可以慢慢说，我在这儿。',
  first: '第一次见到你，真高兴 🌱 我是心语，会一直在。想从哪儿聊起都可以，我会认真听。'
};

// 每日心语：按年内第几天轮换，避免审美疲劳
const DAILY_QUOTES = [
  '你已经撑过了很多个「昨天」，今天也试试看。',
  '情绪不是敌人，它只是来送信的。',
  '慢慢来，比较快。',
  '你不是一个人在战斗，请务必多爱自己一点。',
  '今天，值得一个深呼吸。',
  '把大目标拆小一点，小到不可能失败。',
  '允许自己休息，不是罪过。',
  '你在别人看不见的地方，拼尽全力地活着。',
  '难过的时候翻开这一天：你比想象中坚强。',
  '不求完美，只求完成。',
  '愿你今天，也好好和自己相处。',
  '风吹过的地方，都是路。'
];

Page({
  data: {
    loading: false,
    sessionId: '',
    messages: [],        // [{ role: 'user'|'ai', content, ts? }]
    chatStat: '',          // 底栏陪伴计数
    collapsed: false,      // 长对话折叠：>22 条时点「折叠」收起较早部分
    todayN: 0,           // 今天已经倾诉过几次（陪伴感小徽章）
    intensity: 3,        // 此刻强度 1–5（滑条，随情绪记录落库）
    input: '',
    moodTag: '',         // 当前可选的情绪标签
    aiFace: '',          // AI 头像情绪态：随当前情绪标签切换（''=默认🌱）
    personas: [
      { k: 'friend', emoji: '🤗', t: '朋友' },
      { k: 'vault', emoji: '🌿', t: '树洞' },
      { k: 'coach', emoji: '⚡', t: '清醒教练' }
    ],
    persona: '',           // 本次陪伴身份（本地记住，''=默认）
    feelList: [
      '我今天其实还行，就是有点累。',
      '说实话有点难过，但不知怎么开口。',
      '不太想给建议，就想有人陪我聊聊。'
    ],
    typing: false,       // AI 打字中
    typedText: '',
    showFeeling: false,  // 倾诉后小结算：AI 回复打字完成后的一次性感受标签条
    feelingDone: false,  // 本会话内只出现一次
    _draft: '',          // AI 打字被新消息打断时的半句草稿（下一条接续）
    feelingTags: ['开心', '平静', '难过', '焦虑', '生气', '孤独'],
    showQuick: false,    // 输入栏「⚡快捷」面板
    quickReplies,
    quickEnglish: [
      "I've been so anxious lately…",
      "I feel lonely tonight",
      "I can't fall asleep, my mind keeps racing"
    ],
    // 关键时刻（危机语境）英语快捷句：会触发求助页与热线的安全网
    quickEmergency: [
      "I feel like I can't cope right now",
      "I'm afraid I might hurt myself",
      "Please help me reach a real person"
    ],
    // 自我安抚短句：情绪上来时一键发送，让 AI 顺着安抚（陪伴闭环）
    quickSoothe: [
      '我现在很难受，但决定先待在这里，不评判自己',
      '我承认这一刻很难，也承认我已经撑了很久',
      '情绪是一阵浪，会来也会走；我先做三次深呼吸',
      '此刻我不需要立刻好起来，我只需要被自己接住'
    ],
    // 新手引导（一次性）
    onboarding: false,
    onboardingStep: 0,
    weatherIco: '',   // ☀️/☁️/🌧…
    weatherText: '',   // "10:00 · 晴 · 24℃"（免费 open-meteo，无 key）
    dailyQuote: '',    // 今日心语（日轮换，可点复制）
    nightShow: false,  // 深夜（22:00–5:00）显示深夜工具箱
    replyToMsg: null,  // 引用条：{ role, text } 长按「引用这条」后带入输入框
    lowCare: false,    // 连续低落情绪关怀条（最近 2 天连续偏低的非打扰提示）
    lowCareText: '',
  },

  async onLoad() {
    // 夜间柔和模式：22:00-6:00 自动切换深色氛围（仅陪伴页，减少刺眼）
    const _h = new Date().getHours();
    this.setData({ isNight: _h >= 22 || _h < 6 });
    this.setData({ persona: wx.getStorageSync('hb_persona') || '' });
    // 首次进入且未同意隐私 -> 去欢迎页
    if (!wx.getStorageSync('privacyAgreed')) {
      wx.redirectTo({ url: '/pages/welcome/welcome' });
      return;
    }
    // 新手引导：仅第一次打开显示（本地标记 hb_onboard_v1）
    if (!wx.getStorageSync('hb_onboard_v1')) {
      this.setData({ onboard: true, onboardingStep: 0 });
    }
    // 今日心语：按年内第几天轮换
    const now0 = new Date();
    const dayOfYear = Math.floor((now0 - new Date(now0.getFullYear(), 0, 0)) / 86400000);
    const hour = now0.getHours();
    this.setData({ dailyQuote: DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length], nightShow: hour >= 22 || hour < 5 });
    // 输入框占位符按时段 / 心情轮换（陪伴感，不废话）
    const phs = hour < 5 ? ['还没睡？想说就说，我听着。'] :
      hour < 11 ? ['早上好，今天想先聊点什么？'] :
      hour < 14 ? ['午间慢慢来，把想说的放在这。'] :
      hour < 18 ? ['下午好，心里冒出什么都可以发给我。'] :
      ['晚上好，今天过得怎么样？我在这听。'];
    this.setData({ inputPh: phs[Math.floor(Math.random() * phs.length)] });
    // 天气角（免费 open-meteo，定位失败静默降级为默认城市）
    this.loadWeather();
    // 耐心等登录完成（拿到 isNewUser 才能定制首次欢迎语；失败也不阻塞，用常规欢迎语兜底）
    await app.login().catch(() => {});
    this.initSession();
    // 连续低落情绪关怀：读最近 7 天情绪，若最后 2 天连续偏低（<3.5）给一条非打扰提示
    this.maybeShowLowCare();
    // 今日倾诉次数（给「第 N 次来找我」的陪伴感）
    this.refreshTodayN();
  },

  // 数一数今天已经对 AI 说过几轮话
  refreshTodayN() {
    const now = new Date();
    const k = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    let n = 0;
    (this.data.messages || []).forEach((m) => {
      if (m.role !== 'user' || !m.ts) return;
      const d = new Date(m.ts);
      if (`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` === k) n += 1;
    });
    this.setData({ todayN: n });
  },

  // 连续低落情绪关怀条：不弹窗、不打断，当天只出现一次（可关闭）
  async maybeShowLowCare() {
    try {
      const today = new Date().toDateString();
      if (wx.getStorageSync('chatLowCareSeen') === today) return;
      let openid = app.globalData.openid;
      if (!openid) openid = await app.login();
      if (!openid) return;
      const db = wx.cloud.database();
      const r = await db.collection('moods').where({ openid }).orderBy('createdAt', 'desc').limit(30).get();
      // 最近 7 天逐日取「当天最低分」，从今天往前数连续偏低天数
      const DAY = 86400000;
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const start = new Date(end.getTime() - 6 * DAY); start.setHours(0, 0, 0, 0);
      const dayLow = new Map();
      (r.data || []).forEach((m) => {
        const t = m.createdAt || 0;
        if (t < start.getTime() || t > end.getTime()) return;
        const d = new Date(t); d.setHours(0, 0, 0, 0);
        const k = d.getTime();
        const sc = MOOD_SCORE[m.mood];
        if (sc === undefined) return;
        dayLow.set(k, Math.min(dayLow.has(k) ? dayLow.get(k) : 5, sc));
      });
      // 从今天开始往前，允许中间有一天缺失，数连续偏低天数
      let streak = 0;
      for (let i = 0; i < 7; i++) {
        const k = end.getTime() - i * DAY;
        const d0 = new Date(k); d0.setHours(0, 0, 0, 0);
        const v = dayLow.get(d0.getTime());
        if (v === undefined) { if (streak > 0) break; continue; } // 当天没记录不算偏高，也不打断
        if (v < 3.5) streak += 1;
        else break;
      }
      if (streak < 2) return;
      wx.setStorageSync('chatLowCareSeen', today);
      const text = streak >= 3
        ? `看记录，最近 ${streak} 天你的心有点沉。不用硬撑，想把这些交给 AI 的「身体扫描」或聊聊，我都在。`
        : '这两天你的状态有点低。先慢下来做 3 分钟呼吸，或把此刻的念头说给我听 🌿';
      this.setData({ lowCare: true, lowCareText: text });
    } catch (e) { /* 静默失败，不影响聊天 */ }
  },

  closeLowCare() {
    try { wx.setStorageSync('chatLowCareSeen', new Date().toDateString()); } catch (e) {}
    this.setData({ lowCare: false });
  },

  // 连续低落时的轻引导：顺手写一句给此刻的自己（复用深夜暗语，只存给自己）
  writeToSelf() {
    this.setData({ lowCare: false });
    this.nightToSelf();
  },

  // ---- 天气角：open-meteo（免费、无需 key）----
  copyQuote() {
    if (!this.data.dailyQuote) return;
    wx.setClipboardData({
      data: this.data.dailyQuote,
      success: () => wx.showToast({ title: '已复制今日心语', icon: 'success' })
    });
  },

  // ---- 深夜工具箱：22:00–5:00 出现，给「深夜的你想做点什么」提供小入口 ----
  nightBreathe() { wx.navigateTo({ url: '/pages/breathe/breathe' }); },
  // 大哭/慌张/失控时的「5 分钟急救」：马上能做，延时立刻缓解（固定文案，不耗 AI）
  nightFirstAid() {
    this.pushAI('好，我们只做 5 分钟，跟着我一步一步来：' +
      '\n① 先坐稳或靠墙，双脚踩地（0:00–0:30）' +
      '\n② 「4 秒吸气 → 4 秒屏住 → 6 秒呼气」× 5 轮（0:30–2:00）' +
      '\n③ 慢慢喝一小口水，握紧拳头 5 秒再松开（2:00–3:00）' +
      '\n④ 看着周围说出 3 个颜色、2 个声音、1 个身体能触碰的东西（3:00–4:00）' +
      '\n⑤ 给我回一句「现在我好一点点了吗」，我会一直握着你的手（4:00–5:00）');
  },
  nightWrite() { wx.switchTab({ url: '/pages/mood/mood' }); },
  nightLater() {
    wx.showToast({ title: '把烦心事留给明天的你吧，先去睡 🛌', icon: 'none' });
  },
  // 写给自己：把此刻想说的一句话写进 mood note（trigger='深夜暗语'）
  nightToSelf() {
    wx.showModal({
      title: '写给自己 🌙',
      content: '把此刻想说的一句话存进心情笔记，只有你自己看得到，天亮后再读给自己。',
      editable: true,
      placeholderText: '想对自己说什么…',
      confirmText: '写下',
      cancelText: '算了',
      success: async (r) => {
        const text = (r.content || '').trim();
        if (!r.confirm || !text) return;
        wx.showLoading({ title: '存下中…' });
        try {
          let openid = app.globalData.openid;
          if (!openid) openid = await app.login();
          if (!openid) return;
          await wx.cloud.database().collection('moods').add({
            data: {
              openid,
              sessionId: 'night-' + Date.now(),
              mood: 'peace',
              intensity: 3,
              note: text,
              noteAt: Date.now(),
              trigger: '深夜暗语',
              createdAt: Date.now()
            }
          });
          wx.hideLoading();
          // 睡前托付：给明天的自己留一句话，跨天后自动在聊天里读回给你
          const d = new Date(), pad = (n) => (n < 10 ? '0' + n : n);
          wx.setStorageSync('hb_night_msg', {
            text,
            date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
          });
          wx.showToast({ title: '已存下，明天读给你 🌙', icon: 'success' });
        } catch (err) {
          wx.hideLoading();
          console.error('[chat] 深夜暗语写入失败', err);
          wx.showToast({ title: '存入失败，请重试', icon: 'none' });
        }
      }
    });
  },

  loadWeather() {
    const fetchBy = (lat, lon) => {
      wx.request({
        url: `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
        timeout: 6000,
        success: (r) => {
          const cur = r && r.data && r.data.current_weather;
          if (!cur) return;
          const h = new Date();
          const pad = (n) => (n < 10 ? '0' + n : n);
          this.setData({
            weatherIco: this.wmoEmoji(cur.weathercode),
            weatherText: `${pad(h.getHours())}:${pad(h.getMinutes())} · ${this.wmoText(cur.weathercode)} · ${Math.round(cur.temperature)}℃`
          });
        },
        fail: () => {}
      });
    };
    wx.getLocation({
      type: 'gcj02',
      success: (p) => fetchBy(p.latitude, p.longitude),
      fail: () => wx.getLocation({
        type: 'wgs84',
        success: (p) => fetchBy(p.latitude, p.longitude),
        fail: () => fetchBy(39.9, 116.4)
      })
    });
  },

  wmoText(code) {
    code = Number(code);
    if (code === 0) return '晴';
    if (code <= 2) return '多云';
    if (code === 3) return '阴';
    if (code <= 48) return '雾';
    if (code <= 67) return '雨';
    if (code <= 77) return '雪';
    if (code <= 82) return '阵雨';
    return '雷雨';
  },

  wmoEmoji(code) {
    code = Number(code);
    if (code === 0) return '☀️';
    if (code <= 2) return '⛅';
    if (code === 3) return '☁️';
    if (code <= 48) return '🌫';
    if (code <= 67) return '🌧';
    if (code <= 77) return '🌨';
    if (code <= 82) return '🌦';
    return '⛈';
  },

  // ---- 消息长按：复制 / 珍藏 / 引用 / 我的消息可撤回 ----
  onMsgLongPress(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const item = this.data.messages[idx];
    if (!item) return;
    const content = item.content || '';
    const isUser = item.role === 'user';
    const itemList = isUser
      ? ['复制这条消息', '引用这条', '珍藏（存到我的珍藏）', '撤回我的这条']
      : ['复制一句话', '引用这句话', '珍藏（存到我的珍藏）', '换个说法（重新生成）'];
    wx.showActionSheet({
      itemList,
      success: (r) => {
        if (r.tapIndex === 0) {
          wx.setClipboardData({ data: content, success: () => wx.showToast({ title: '已复制', icon: 'none' }) });
        } else if (r.tapIndex === 1) {
          // 引用这条：把原句带进输入框（可修改后发送）
          this.setData({
            replyToMsg: { role: item.role, text: content },
            input: content
          });
        } else if (r.tapIndex === 2) {
          const favs = wx.getStorageSync('hb_favs') || [];
          if (favs.length >= 5) favs.shift();
          favs.push({
            text: content,
            role: item.role,
            time: new Date().toLocaleString('zh-CN', { hour12: false })
          });
          wx.setStorageSync('hb_favs', favs);
          wx.showToast({ title: '已珍藏 💛', icon: 'none' });
          if (!wx.getStorageSync('ach_fav')) wx.setStorageSync('ach_fav', true);
        } else if (isUser && r.tapIndex === 3) {
          // 撤回我的这条：删掉该消息及紧随其后的 AI 回复，本地即时生效
          const messages = this.data.messages.slice();
          const drop = messages[idx + 1] && messages[idx + 1].role === 'ai' ? 2 : 1;
          messages.splice(idx, drop);
          this.setData({ messages });
          wx.showToast({ title: '已撤回这条', icon: 'none' });
        } else if (!isUser && r.tapIndex === 3) {
          // 换个说法：把这条 AI 回复重生成（用同样的上文重新问一次）
          this.reask(idx);
        }
      }
    });
  },

  // 取消引用（点 ✕ 收起引用条，输入框内容保留）
  clearReply() {
    this.setData({ replyToMsg: null });
  },

  onBoardNext() {
    if (this.data.onboardingStep >= 2) {
      wx.setStorageSync('hb_onboard_v1', true);
      this.setData({ onboarding: false });
    } else {
      this.setData({ onboardingStep: this.data.onboardingStep + 1 });
    }
  },

  onBoardSkip() {
    wx.setStorageSync('hb_onboard_v1', true);
    this.setData({ onboarding: false });
  },

  initSession() {
    const hour = new Date().getHours();
    let greeting =
      app.globalData.isNewUser
        ? GREETINGS.first
        : hour >= 22 || hour < 5 ? GREETINGS.night
        : hour < 11 ? GREETINGS.morning : hour < 19 ? GREETINGS.afternoon : GREETINGS.evening;
    if (this.data.persona === 'vault') greeting += ' 你想说的，我都接着，不评判。';
    else if (this.data.persona === 'coach') greeting += ' 今天想怎么面对？我陪你一条一条捋。';
    else if (this.data.persona === 'friend') greeting += ' 今天也当你的朋友，怎么舒服怎么来。';
    // 上午（5–11 点）今天还没记录心情时，轻轻提醒一次（每天仅一次）
    const todayKey = new Date().toDateString();
    if (hour >= 5 && hour < 11
        && wx.getStorageSync('hb_lastMoodDate') !== todayKey
        && wx.getStorageSync('hb_nudgeMorning') !== todayKey) {
      wx.setStorageSync('hb_nudgeMorning', todayKey);
      greeting = greeting.replace(/。$/, '') + '。今天还没记录过心情，花 5 秒记下就好 🌅';
    }
    // 自评陪伴计划进行中：每天轻提一句今天的任务（每天仅一次，打完卡不再提）
    const plan = planlib.load();
    const pi = planlib.activeIndex(plan);
    const planHintKey = `hb_planHint_${pi}`;
    if (plan && pi >= 0 && pi < plan.days.length
        && !(plan.done && plan.done[pi])
        && wx.getStorageSync(planHintKey) !== todayKey) {
      wx.setStorageSync(planHintKey, todayKey);
      const day = plan.days[pi];
      this.pushPlanHintLater(`📋 陪伴计划第 ${pi + 1} 天：「${day.title}」——${day.desc}`);
    }
    const sessionId = String(Date.now());
    this.setData({ sessionId });
    this.setAI(5); // 初始会话 ID 就绪后可向云函数获取历史；MVP 简化为固定 ID
    this.pushAI(greeting, false);
    // 昨晚留给今天自己的话：跨天后第一次打开自动读给你听（读过即清除）
    const tonight = wx.getStorageSync('hb_night_msg');
    if (tonight && tonight.text && tonight.date && tonight.date !== todayKey) {
      wx.removeStorageSync('hb_night_msg');
      setTimeout(() => {
        this.pushAI('🌙 昨晚你给自己留了一句话，现在读给你听：' +
          '“' + String(tonight.text).slice(0, 80) + '”' +
          '\n\n那句话是真实的，向今天的你伸出手。', true);
      }, 1500);
    }
    this.maybeCheckIn();
  },

  // 计划提示比问候晚 1.2s 出现，避免两条消息挤在一起
  pushPlanHintLater(text) {
    setTimeout(() => {
      if (this.data.messages.length) this.pushAI(text, false);
    }, 1200);
  },

  // 危机回访：helper 页设置过「温暖回访计划」（1h / 24h / 3 天 / 7 天），到期后按阶段轻轻问候
  maybeCheckIn() {
    // 旧版单次 24h 回执（crisisCheck）兼容
    const legacy = wx.getStorageSync('crisisCheck');
    if (legacy && legacy <= Date.now()) {
      wx.removeStorageSync('crisisCheck');
      this.pushAI("已经过去一天了哦。你现在感觉怎么样？无论有没有好一点，都允许自己慢慢来。想聊的话我一直都在 🌱", false);
    }
    const plan = wx.getStorageSync('hbCarePlan');
    if (!Array.isArray(plan) || !plan.length) return;
    const now = Date.now();
    const due = plan.filter((p) => p && p.t <= now);
    if (!due.length) return;
    const keep = plan.filter((p) => p && p.t > now);
    wx.setStorageSync('hbCarePlan', keep);
    const stage = ['刚刚那阵一定很难受。先陪自己做 3 个深呼吸，我在。',
      '过了一天了，想问你：现在还好吗？不管答案是什么，我都在这 🌱',
      '几天过去了 —— 有没有哪一个时刻，你觉得其实没那么糟？',
      '7 天啦，这一周你一直在学习照顾自己。要是愿意，去「心情」记一笔现在的感受吧。'];
    due.forEach((p) => this.pushAI(stage[(p.s || 0) % stage.length], false));
  },

  // 重新开始这轮对话：清空当前消息流、换新会话；情绪记录与成就不受影响
  // 复制这段对话（数据主权：你的倾诉随时可以带走留档）
  copyTalk() {
    const msgs = this.data.messages || [];
    if (!msgs.length) { wx.showToast({ title: '还没有对话内容', icon: 'none' }); return; }
    const lines = msgs.map((m) => (m.role === 'user' ? '我：' : '心语：') + (m.text || m.content || ''));
    wx.setClipboardData({
      data: '—— 我和心语伴的一段对话（' + new Date().toLocaleDateString() + '）——\n' + lines.join('\n'),
      success: () => wx.showToast({ title: '已复制整段对话', icon: 'success' })
    });
  },

  resetChat() {
    wx.showModal({
      title: '重新开始这轮对话？',
      content: '当前聊天内容会清空，重新打个招呼。你的情绪记录、成就和珍藏都不会变。',
      confirmText: '重新开始',
      cancelText: '先不了',
      success: (r) => {
        if (!r.confirm) return;
        this.setData({ messages: [], input: '', typing: false, loading: false, showFeeling: false, feelingDone: false, moodTag: '', aiFace: '', _draft: '' });
        this.initSession();
        wx.showToast({ title: '已重新开始', icon: 'none' });
      }
    });
  },

  setAI(timeout) {
    // 预留：从云端恢复历史会话可在此实现
  },

  // 总结这轮对话：不读最近心事全文，只给一段温柔的「回望」+ 一句鼓励
  summarize() {
    const msgs = this.data.messages || [];
    const users = msgs.filter((m) => m.role === 'user' && m.content);
    const ais = msgs.filter((m) => m.role === 'ai' && m.content);
    if (!users.length) {
      wx.showToast({ title: '还没开始聊呢，先和我说句心里话吧', icon: 'none' });
      return;
    }
    const cut = (t, n) => (t.length > n ? t.slice(0, n) + '…' : t);
    const firstS = cut(users[0].content, 14);
    const lastS = cut(users[users.length - 1].content, 14);
    const lastMood = this.data.moodTag;
    const lines = [
      `这轮我们聊了 ${users.length} 条心事，我也陪你说了 ${ais.length} 次。`,
      `你从「${firstS}」聊起`,
      `说到「${lastS}」`,
      lastMood ? `此刻的感觉像「${lastMood}」。` : '',
      '愿意把情绪交出来，本身就是一件勇敢的事。慢慢来，我在。'
    ].filter(Boolean);
    const text = lines.join(' ');
    wx.showModal({
      title: '✨ 这轮对话的小结',
      content: text,
      confirmText: '复制一份',
      cancelText: '收好了',
      success: (r) => {
        if (r.confirm) wx.setClipboardData({ data: text });
      }
    });
  },

  pushAI(content, type = true) {
    this.setData({ messages: this.data.messages.concat([{ role: 'ai', content }]), typing: true });
    this.typewriter(content);
  },

  // 选择陪伴身份：朋友 / 树洞 / 清醒教练（本地记住，下次自动沿用）
  setPersona(e) {
    const k = e.currentTarget.dataset.k;
    if (!k) return;
    wx.setStorageSync('hb_persona', k);
    this.setData({ persona: k });
    const tip = k === 'vault' ? '好，我安静地接着，不评判。' : k === 'coach' ? '好，我们清醒地聊，问题一个个拆。' : '好，朋友模式：平等、轻松、像隔壁桌那个人。';
    wx.showToast({ title: tip.split('。')[0], icon: 'none' });
  },

  // 陪伴里程碑：她说得越多，陪伴的重量越实（本地累计，到了就点亮一次）
  touchMilestone() {
    const total = (wx.getStorageSync('hb_chatLife') || 0) + 1;
    wx.setStorageSync('hb_chatLife', total);
    const marks = [[111, '我们已经聊了 111 句。每一句都被认真接住了，谢谢你一直来找我'], [333, '333 句了。你慢慢说得越开，我也越来越懂你'], [999, '999 句，是几乎每天的陪伴。你心里有个角落，永远是亮的']];
    for (const [n, txt] of marks) {
      if (total === n && !wx.getStorageSync('ach_milestone_' + n)) {
        wx.setStorageSync('ach_milestone_' + n, true);
        setTimeout(() => wx.showModal({ title: '💛 一个小里程碑', content: txt + '。', confirmText: '好', showCancel: false }), 400);
      }
    }
  },

  pushUser(v) {
    const ts = Date.now();
    this.setData({ messages: this.data.messages.concat([{ role: 'user', content, ts }]) });
    this.setData({ todayN: this.data.todayN + 1 });
    this.touchMilestone();
    this.refreshChatStats();
  },

  // 折叠/展开：长对话只保留最近 22 条（本地展示优化）
  collapseChat() { this.setData({ collapsed: true }); },
  expandChat() { this.setData({ collapsed: false }); },

  // 底栏陪伴计数：这轮聊了几句（我回应）+ 你写了多少字
  refreshChatStats() {
    const msgs = this.data.messages || [];
    const u = msgs.filter((m) => m.role === 'user' && m.content);
    const chars = u.reduce((a, m) => a + String(m.content || '').length, 0);
    this.setData({ chatStat: `已聊 ${u.length} 句 · 你写了 ${chars} 字` });
  },

  /* 打字机效果 */
  typewriter(fullText) {
    let i = 0;
    this.setData({ typedText: '', typing: true });
    this.timer = setInterval(() => {
      i += 2;
      if (i >= fullText.length) {
        clearInterval(this.timer);
        this.setData({ typing: false, typedText: fullText });
        this.maybeShowFeeling();
      } else {
        this.setData({ typedText: fullText.slice(0, i) });
      }
      this.scrollBottom();
    }, 30);
  },

  // 倾诉后小结算：AI 回复打完后，本会话内只亮一次「此刻感觉」标签条
  maybeShowFeeling() {
    if (this.data.feelingDone || !this.data.messages.length) return;
    const tags = this.data.feelingTags;
    this.setData({ showFeeling: true, feelingDone: true });
  },

  onFeelingTap(e) {
    const label = e.currentTarget.dataset.m;
    this.setData({ showFeeling: false, moodTag: label, aiFace: AI_FACE[label] || '' });
    this.recordMood(label); // recordMood 自带 toast 与落库
  },

  closeFeeling() { this.setData({ showFeeling: false }); },

  scrollBottom() {
    wx.createSelectorQuery()
      .select('#msgEnd')
      .boundingClientRect((rect) => {
        if (rect) wx.pageScrollTo({ scrollTop: rect.top + rect.height, duration: 200 });
      })
      .exec();
  },

  onInput(e) { this.setData({ input: e.detail.value }); },

  // 此刻强度滑条（1–5）：影响下一次情绪记录的 intensity 字段
  onIntensity(e) {
    this.setData({ intensity: e.detail.value });
  },

  onMood(e) {
    const label = e.currentTarget.dataset.m;
    this.setData({ moodTag: label, aiFace: AI_FACE[label] || '' });
    this.pushUser('我今天想倾诉情绪：' + label); // 直接发送情绪标签
    this.recordMood(label); // 同步落库，形成「倾诉+记录」双闭环
  },

  // 把所选情绪写入 moods 集合（与心情页共用同一数据源）
  async recordMood(label) {
    const key = MOOD_KEY[label];
    if (!key) return;
    let openid = app.globalData.openid;
    if (!openid) openid = await app.login();
    if (!openid) return;
    try {
      const db = wx.cloud.database();
      await db.collection('moods').add({
        data: {
          openid,
          sessionId: 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          mood: key,
          intensity: this.data.intensity || 3,
          trigger: '聊天标签',
          createdAt: Date.now()
        }
      });
      if (!wx.getStorageSync('ach_firstRecord')) wx.setStorageSync('ach_firstRecord', true);
      wx.setStorageSync('hb_lastMoodDate', new Date().toDateString());
      wx.vibrateShort && wx.vibrateShort({ type: 'light' });
      wx.showToast({ title: '心情已记录，到心情页看曲线', icon: 'none' });
    } catch (e) {
      console.error('[chat] 心情落库失败', e);
    }
  },

  onQuick(e) { this.setData({ showQuick: false }); this.send(e.currentTarget.dataset.text); },

  // 即时 3 次深呼吸引导（固定文案，不打 AI）
  breatheNow() {
    this.setData({ showQuick: false });
    this.pushAI('好的，跟我做 3 次深呼吸：' +
      '\n第一次：鼻子吸气 4 秒…吸满…屏住 1 秒…嘴巴缓慢呼气 6 秒' +
      '\n第二次：吸气 4 秒…升高…呼气 6 秒，喉咙慢慢放松' +
      '\n第三次：吸气 4 秒…呼气 6 秒，肩膀跟着往下沉' +
      '\n\n呼吸变慢的那一刻，身体会记住：此刻你是安全的。' +
      '\n等稳一点再决定要不要继续说；不说也没关系，我陪着你。');
    setTimeout(() => { wx.vibrateShort && wx.vibrateShort({ type: 'medium' }); }, 600);
  },

  // 夸夸我：点击即给一句温柔夸奖（本地词库，不打字也不耗 AI）
  onPraise() {
    this.setData({ showQuick: false });
    const pool = [
      '今天你愿意打开小程序，愿意和自己说说话，这件事本身就值得一个大大的赞 🌟',
      '你应该被夸：应对生活的同时，还记得照顾自己的情绪，这不是谁都做得到的。',
      '我想认真地夸夸你：你比你以为的更坚韧，也更有温度。',
      '夸你三件事：你还在这里、你愿意求助、你不放弃自己。就凭这三件，你已经很棒了。',
      '你知道我最欣赏你哪一点吗？不太完美，却一直在往前走。这已经足够耀眼。',
      '抱抱你。你不需要完美才配被爱，你出现在努力的路上，本身就闪闪发光。'
    ];
    this.pushAI(pool[Math.floor(Math.random() * pool.length)]);
  },

  // 英语角：点一下直接发送（等同 onQuick，英文输入会自动触发英文回复）
  onQuickEn(e) { this.setData({ showQuick: false }); this.send(e.currentTarget.dataset.text); },

  toggleQuick() { this.setData({ showQuick: !this.data.showQuick }); },

  onSend() {
    const text = this.data.input.trim();
    if (!text) return;
    this.setData({ input: '' });
    this.send(text);
  },

  async send(text) {
    // 发送时收起引用条
    if (this.data.replyToMsg) this.setData({ replyToMsg: null });
    this.pushUser(text);
    this.setData({ moodTag: '' });
    // AI 打字中收到新消息：把已打出的半句存为草稿，让下一条回复接着它继续（不丢失、不覆盖）
    if (this.data.typing && this.data.typedText) {
      this._draft = this.data.typedText;
      if (this.timer) clearInterval(this.timer);
      this.setData({ typing: false, typedText: '' });
    }
    // 组装历史（最近 10 条）
    const history = this.data.messages.slice(-10).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    this.setData({ loading: true });
    try {
      const res = await api.call('aiChat', {
        sessionId: this.data.sessionId,
        userInput: text,
        history,
        intensity: this.data.intensity || 3, // 此刻强度（云函数可用可忽略）
        assessment: this.getLastAssessment()
      });
      const r = res.result || {};
      this.setData({ loading: false });
      // 接续草稿：若上一条被打断，把半句续在开头，让倾诉连续不丢失
      const draft = this._draft || '';
      this._draft = '';
      const reply = r.content || '我在，慢慢说。';
      const joined = draft
        ? (/[。！？…~]$/.test(draft) ? draft : draft + '…') + reply
        : reply;
      this.pushAI(joined);

      // 危机分级响应（high 弹窗推送求助页 / mid 温和引导 / low 不打扰）
      this.handleCrisis(r.crisis);
    } catch (err) {
      this.setData({ loading: false });
      this.pushAI('😔 线上有点忙，请再试一次，我一直在。');
    }
  },

  // 长按 AI 消息「换个说法」：删掉这条回复，用同样的上文重新生成一次
  async reask(idx) {
    if (this.data.loading) return;
    const messages = this.data.messages.slice();
    // 找到该条 AI 回复前面最近的一条用户消息（作为重问的输入）
    let userText = '';
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i] && messages[i].role === 'user') { userText = messages[i].content; break; }
    }
    if (!userText) {
      wx.showToast({ title: '找不到对应的开头，请直接重发', icon: 'none' });
      return;
    }
    // 删除该条 AI 回复及其后连续的 AI 回复（保留更早的用户消息）
    let end = idx;
    while (end < messages.length && messages[end].role !== 'user') end++;
    messages.splice(idx, end - idx);
    this.setData({ messages });
    const history = messages.slice(-10).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));
    this.setData({ loading: true });
    try {
      const res = await api.call('aiChat', {
        sessionId: this.data.sessionId,
        userInput: userText,
        history,
        intensity: this.data.intensity || 3,
        assessment: this.getLastAssessment()
      });
      const r = res.result || {};
      this.setData({ loading: false });
      this.pushAI(r.content || '我在，慢慢说。');
      this.handleCrisis(r.crisis);
    } catch (err) {
      this.setData({ loading: false });
      this.pushAI('😔 线上有点忙，请再试一次，我一直在。');
    }
  },

  // 最近一次自评（3 天内有效），供 AI 上下文使用
  getLastAssessment() {
    try {
      const a = wx.getStorageSync('lastAssessment');
      if (!a || !a.ts) return null;
      if (Date.now() - a.ts > 3 * 24 * 3600 * 1000) return null;
      return { total: a.total, label: a.label };
    } catch (e) { return null; }
  },

  handleCrisis(crisis) {
    if (!crisis || !crisis.level) return;
    const tip = crisis.tip || '如果需要，这里有一些能立刻帮到你的方式。';
    if (crisis.level === 'high') {
      wx.showModal({
        title: '我愿意陪着你',
        content: '听起来你现在很不容易。请一定向身边的人求助，或拨打心理援助热线。' + tip,
        confirmText: '去看看帮助',
        cancelText: '继续聊聊',
        success: (r) => {
          if (r.confirm) wx.switchTab({ url: '/pages/helper/helper' });
        }
      });
      // 高危信号第一次出现时，多说一句「请认真对待我的提醒」（只出现一次）
      if (!wx.getStorageSync('hb_crisis_serious')) {
        wx.setStorageSync('hb_crisis_serious', 1);
        this.pushAI('我不只是程序，我是认真的：当你听到「请立刻求助」，请一定照着做。你的安全，比什么都重要。');
      }
    } else if (crisis.level === 'mid') {
      wx.showModal({
        title: '我听到你了',
        content: tip,
        confirmText: '看看求助页',
        cancelText: '继续聊聊',
        success: (r) => {
          if (r.confirm) wx.switchTab({ url: '/pages/helper/helper' });
        }
      });
    } else {
      // low：不弹窗打扰，短短一行就好
      this.pushAI('（如果这份低落持续很久，别忘了求助页一直有人在等你。）');
    }
  },

  onUnload() { if (this.timer) clearInterval(this.timer); }
});