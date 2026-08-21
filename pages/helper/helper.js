// pages/helper/helper.js —— 求助中心
const { hotlines } = require('../../config/index');
const { MOOD_SCORE } = require('../../utils/moodscore');
const app = getApp();

// 今日关怀：按当日轮换的轻量贴士（本地生成，无网络依赖）
const CARE_NOTES = [
  { emoji: '🌤', title: '抬头看看天气', text: '无论屏幕外是雨天还是晴，都在提醒你：此刻的真实世界，也会过去的。' },
  { emoji: '💧', title: '喝一杯水', text: '情绪起伏时先照顾身体——喝口水、站起来伸个懒腰，再回来处理事情。' },
  { emoji: '🧘', title: '给自己 3 分钟', text: '去「呼吸练习」页做一轮慢呼吸：吸气 4 秒、停 4 秒、呼气 5 秒。' },
  { emoji: '📝', title: '写下一件小事', text: '今天有没有一件让你感觉好一点的小事？写下来，重复它。' },
  { emoji: '🌳', title: '走到户外去', text: '如果可能，出门走 10 分钟，让光线和风换一换心情。' },
  { emoji: '💬', title: '联系一个"搭子"', text: '给信任的人发条消息，哪怕只是「今天还好吗」，别把情绪闷住。' },
  { emoji: '🌙', title: '今晚早点睡', text: '入睡前 30 分钟放下手机，让大脑慢慢冷却下来。' }
];

// 我撑过来了：5 步自助（剖析 → 行动 → 陪伴 → 收尾）
const SELF_STEPS = [
  { q: '先停一下，说出此刻的感受是什么？（害怕 / 委屈 / 喘不上气…都可以）' },
  { q: '此刻最让你难受的那件事，具体是什么？' },
  { q: '如果现在只能做一件小事让自己好受一点，会是什么？' },
  { q: '如果此刻你信任的人就在身边，你想告诉他“我…”？' },
  { q: '给你自己一句收尾的话（今天你已经很好了）' }
];

Page({
  data: {
    triageDone: false,
    safePeople: '',               // 安全包：可信赖的人称呼（本地）
    askSituations: [              // 开口求助：处境选项（本地生成话术）
      { k: 'sleep',    label: '我最近睡不好' },
      { k: 'anxious',  label: '我很焦虑、静不下心' },
      { k: 'low',      label: '我最近很低落' },
      { k: 'pressure', label: '学习压力快撑不住了' },
      { k: 'talk',     label: '我想找心理老师聊聊' }
    ],
    scriptSituation: '',
    scriptText: '',
    hotlines,
    safety: false, // 是否已设置 24 小时回访
    safetyHint: '',
    care: null,      // 今日关怀 { emoji, title, text }
    englishPhrases: [],  // 英文小抄（一键复制）
    // 我撑过来了 5 步
    self: SELF_STEPS,
    selfStep: -1,       // -1=未开始；0-4=进行中
    selfInput: '',
    selfLast: null,     // { date, done } 上次收尾
    selfResumeStep: 0,   // >0 表示有未走完的存档（第几步），可一键接着走
    followCare: null     // 回访关怀卡 { note, dueAt, dueText }
    ,hushCare: false   // 求助后静音关怀：安排回访 3 天内，顶部一条轻量不打扰的卡
    ,smartTip: null      // 智能分流：此刻建议（按时段/连续低情绪天数，轻提示不打扰）
  },

  // ---- 要一句安慰的话：随机温和短句，可记住 / 可复制给自己 ----
  // 现在最需要什么：三选一快速分流（先给出口，不给判断）
  onNeedNav() {
    wx.setStorageSync('hb_triageDone', new Date().toDateString());
    wx.showActionSheet({
      itemList: ['心很乱·停不下来 → 呼吸练习', '闷得慌·想说出来 → 找心语聊聊', '发空·不知道自己要什么 → 随手整理心情'],
      success: (r) => {
        const go = ['/pages/breathe/breathe', '/pages/chat/chat', '/pages/mood/mood'];
        const url = go[r.tapIndex];
        if (url === '/pages/chat/chat' || url === '/pages/mood/mood') wx.switchTab({ url });
        else wx.navigateTo({ url });
      }
    });
  },

  // ---- 开口求助话术生成器（本地模板，可复制发送）----
  pickSituation(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ scriptSituation: k });
    this.regenScript(k);
  },
  regenScript(k) {
    const key = k || this.data.scriptSituation;
    if (!key) return;
    const first = (wx.getStorageSync('hbSafePeople') || '').split('、')[0].trim();
    const call = first && first.length <= 6 ? first : '您';
    const TPL = {
      sleep: [
        `老师/爸妈，想跟您说一件事：我最近入睡很难，躺在床上一两个小时都睡不着，白天上课也很困。我不是偷玩手机，是真的睡不着。想请您陪我想想办法，或者去看看医生。`,
        `跟您说个事：这段时间我总是睡不好，半夜会醒，早上起来很累。我有点撑不住了，想找您聊聊，也想知道要不要寻求专业帮助。`
      ],
      anxious: [
        `${call === '您' ? '老师' : call}，我最近心里总是很慌，静不下心学习，有时候心跳很快、手心出汗。我试着调节过，但没什么用。我想让您知道，也希望有人能帮帮我。`,
        `我想说一件事：最近我总是莫名紧张，考试前尤其严重，脑子里停不下来。我怕一直这样下去，想找您或专业的人聊一聊。`
      ],
      low: [
        `跟您说这些有点难，但我最近情绪一直很低落，对什么都提不起兴趣，有时候觉得撑不下去了。我不想让您担心，但我真的需要有人陪我。`,
        `我最近状态很差，经常想哭，也吃不下饭。我知道这样不对劲，想请您帮帮我，或者带我去看一次心理医生。`
      ],
      pressure: [
        `我最近学习压力特别大，作业和考试排得很满，我感觉快撑不住了。不是我不想努力，是我真的太累了。想跟您商量一下，能不能帮我减掉一点，或者教我怎么安排。`,
        `想跟您坦白：这段时间我一直咬牙撑着，但越撑越焦虑，晚上也睡不好。我怕这样下去会垮掉，希望您能听我说说，帮我一起想想办法。`
      ],
      talk: [
        `老师，我最近心里有些事，一直自己扛着，有点扛不住了。想找您聊一聊，大概需要 20 分钟。如果您这周有时间，请告诉我什么时候方便。`,
        `老师您好，我想预约一次心理谈话。这段时间我情绪不太好，也睡不好，想找专业的人聊聊。您方便的时候回我一下就好。`
      ]
    };
    const arr = TPL[key] || [];
    if (!arr.length) { this.setData({ scriptText: '' }); return; }
    const pick = arr[Math.floor(Math.random() * arr.length)];
    this.setData({ scriptText: pick });
  },
  copyScript() {
    if (!this.data.scriptText) return;
    wx.setClipboardData({
      data: this.data.scriptText,
      success: () => wx.showToast({ title: '已复制，发给信任的人', icon: 'success' })
    });
  },

  onComfort() {
    const P = [
      '抱撑到现在已经很好了，今天也辛苦啦。',
      '允许自己今天只是「停着」，不用立刻好起来。',
      '你不是一个人，我一直在这里陪着你。',
      '慢慢来，你不需要马上变好。',
      '把此刻先放下，明天再想也不迟。',
      '难受是真实的，但它不会一直这么大。'
    ];
    const t = P[Math.floor(Math.random() * P.length)];
    wx.showModal({
      title: '🌿 先接住这句话',
      content: t,
      confirmText: '记住了',
      cancelText: '复制给自己',
      success: (r) => { if (!r.confirm) wx.setClipboardData({ data: t }); }
    });
  },

  onShow() {
    this.loadFollowUp();
    this.loadHushCare();
    this.loadSmartTip();
    // 当天已用过“方向选择”→ 隐藏（次日恢复）
    this.setData({ triageDone: wx.getStorageSync('hb_triageDone') === new Date().toDateString() });
    // 安全包：预先填写的「可信赖的人」称呼（本地）
    const ppl = wx.getStorageSync('hbSafePeople') || '';
    if (ppl !== this.data.safePeople) this.setData({ safePeople: ppl });
  },

  // 安全包：唤起填写/修改「我想让谁记得我」（本地保存 3 人以内）
  editSafePeople() {
    wx.showModal({
      title: '安全包 · 我的求助名单',
      content: '是谁，能在你最难受的时候找到？写 1-3 个称呼（如：妈妈、王老师、室友），危急时心语会提醒你联系她们。',
      editable: true,
      placeholderText: '妈妈、王老师、室友',
      confirmText: '保存',
      success: (r) => {
        if (!r.confirm) return;
        const raw = (r.content || '').trim();
        const names = raw.split(/[，,、\s]+/).filter(Boolean).slice(0, 3);
        wx.setStorageSync('hbSafePeople', names.join('、'));
        this.setData({ safePeople: names.join('、') });
        wx.showToast({ title: names.length ? '已收进安全包 🌱' : '已清空', icon: 'none' });
      }
    });
  },

  // 智能分流：按时段 + 最近连续低情绪天数，给一条最相关的此刻建议（轻提示条，不打扰）
  async loadSmartTip() {
    let lowStreak = 0;
    try {
      let openid = app.globalData.openid;
      if (!openid) openid = await app.login();
      if (!openid) return;
      const db = wx.cloud.database();
      const r = await db.collection('moods').where({ openid }).orderBy('createdAt', 'desc').limit(30).get();
      // 只保留最近 7 天的「每日最低分」（一天多条取当天最低，最能反映低情绪）
      const dayLow = new Map();
      const DAY = 86400000;
      const now0 = new Date(); now0.setHours(0, 0, 0, 0);
      (r.data || []).forEach((m) => {
        const d = new Date(m.createdAt);
        d.setHours(0, 0, 0, 0);
        if (now0 - d > 6 * DAY) return;
        const k = d.getTime();
        const sc = MOOD_SCORE[m.mood];
        if (sc === undefined) return;
        dayLow.set(k, Math.min(dayLow.has(k) ? dayLow.get(k) : 5, sc));
      });
      // 从今天（无记录则从昨天）往过去数连续低分天数
      const ks = Array.from(dayLow.keys()).sort((a, b) => b - a);
      let cursor = now0.getTime();
      ks.forEach((k) => {
        if (k <= cursor) {
          if (dayLow.get(k) < 3.5) lowStreak += 1;
          else lowStreak = 0;
          cursor = k - DAY;
        }
      });
    } catch (e) { /* 不影响页面 */ }

    const hour = new Date().getHours();
    let tip = null;
    if (hour >= 22 || hour < 6) {
      tip = { emoji: '🌙', title: '深夜里，别独自硬扛', text: '先做 3 分钟呼吸，或去「写给自己一句」把心事放下来；撑不住时，点上方热线号码。' };
    } else if (lowStreak >= 3) {
      tip = { emoji: '💙', title: `连续 ${lowStreak} 天有点低`, text: '辛苦了。先喝口水、慢慢呼吸；也可以把最近的事说给我听，或先打给热线喘口气。' };
    } else if (lowStreak >= 2) {
      tip = { emoji: '🌱', title: '最近两天不太稳', text: '试试下方「呼吸练习」3 分钟，或直接戳一个信任的人聊聊，别一个人扛。' };
    } else if (hour < 11) {
      tip = { emoji: '🌤', title: '早上的你，值得被温柔以待', text: '今天从喝一杯水开始。如果心里闷，「我撑过来了」5 步自助也许能帮你理一理。' };
    } else {
      tip = { emoji: '🧭', title: '先把眼前的一小步走好', text: '此刻不舒服的话，先做 3 分钟呼吸；需要人陪，也可以先在聊天里找我。' };
    }
    this.setData({ smartTip: tip });
  },

  // 求助后静音关怀：安排回访 3 天内，顶部显示一条轻量关怀卡（不弹窗、可关闭、当天不再显示）
  loadHushCare() {
    try {
      const seen = wx.getStorageSync('helperHushSeen') || '';
      if (seen === new Date().toDateString()) { this.setData({ hushCare: false }); return; }
      const ok = wx.getStorageSync('crisisCheck');
      if (!ok) { this.setData({ hushCare: false }); return; }
      const wentAt = ok - 24 * 3600 * 1000; // 回安排时间（crisisCheck=到期时刻，减去 24h）
      if (Date.now() - wentAt > 3 * 86400000) { this.setData({ hushCare: false }); return; }
      this.setData({ hushCare: true });
    } catch (e) {
      this.setData({ hushCare: false });
    }
  },

  closeHushCare() {
    try { wx.setStorageSync('helperHushSeen', new Date().toDateString()); } catch (e) {}
    this.setData({ hushCare: false });
  },

  // 回访关怀卡：读取 followUps 最近一条「待回访」记录（到期未超 3 天），展示给用户
  async loadFollowUp() {
    try {
      let openid = this._app ? this._app.globalData.openid : '';
      if (!openid) {
        this._app = getApp();
        openid = this._app && this._app.globalData.openid;
      }
      if (!openid) return;
      const db = wx.cloud.database();
      const _ = db.command;
      const res = await db.collection('followUps')
        .where({ openid, status: 'open', dueAt: _.gte(Date.now() - 3 * 86400000) })
        .orderBy('dueAt', 'asc')
        .limit(1)
        .get()
        .catch(() => ({ data: [] }));
      const f = (res.data || [])[0];
      if (!f) { this.setData({ followCare: null }); return; }
      const remain = f.dueAt - Date.now();
      const dueText = remain > 0
        ? (remain > 86400000 ? `${Math.ceil(remain / 86400000)} 天内` : `${Math.max(1, Math.ceil(remain / 3600000))} 小时内`)
        : '正在进行中';
      this.setData({ followCare: { note: f.note || '我想回来看看你', dueAt: f.dueAt, dueText } });
    } catch (e) {
      // 无权限/网络异常时静默隐藏，不影响求助页
      this.setData({ followCare: null });
    }
  },

  onLoad() {
    const t = wx.getStorageSync('crisisCheck');
    if (t && t > Date.now()) this.setData({ safety: true });
    // 五步自助：恢复 3 天内未走完的存档（记住走到第几步、写过的答案）
    const prog = wx.getStorageSync('selfCareProgress');
    if (prog && prog.step >= 0 && prog.step < 4 && Date.now() - (prog.ts || 0) < 3 * 86400000) {
      this._resume = prog;
      this.setData({ selfResumeStep: prog.step + 1 });
    } else if (prog) {
      wx.removeStorageSync('selfCareProgress'); // 过期存档清掉
    }
    // 今日关怀：按「年内第几天」取一条日轮换，另加一句时间文案
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
    const note = CARE_NOTES[dayOfYear % CARE_NOTES.length];
    const hour = today.getHours();
    const moment = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    this.setData({
      care: {
        emoji: note.emoji,
        title: `${moment} · ${note.title}`,
        text: note.text
      },
      englishPhrases: [
        { en: "I've been feeling really anxious lately.", zh: '我最近一直很焦虑。' },
        { en: "I can't fall asleep, my mind keeps racing.", zh: '我睡不着，脑子停不下来。' },
        { en: "I feel lonely tonight.", zh: '今晚我好孤独。' },
        { en: "I'm so tired and sad today.", zh: '我今天又累又难过。' },
        { en: "I'm proud of myself for making it through.", zh: '我为撑过来的自己感到骄傲。' },
        { en: "I need to hear something gentle right now.", zh: '现在我想听一句温柔的话。' }
      ]
    });
  },

  // 复制英文句子 → 回聊天粘贴即可（英文小抄）
  copyEn(e) {
    const en = e.currentTarget.dataset.en;
    if (!en) return;
    wx.setClipboardData({
      data: en,
      success: () => wx.showToast({ title: '已复制，去聊天粘贴 🌱', icon: 'none' })
    });
  },

  // 复制「向信任的人求助」的短信模板（脱敏、可直接发）
  copyHelpSms() {
    const text = ['你好，我需要认真地跟你说一件事。',
      '最近一段时间我的情绪一直很低落，晚上也总睡不好，一个人的时候特别难受，偶尔会想到更坏的结果。',
      '我知道不该一个人硬扛，所以决定告诉你。',
      '我不要求你立刻解决什么，只想让你知道我在经历这些。如果可以，能不能陪我坐一会儿，或者帮我想办法——比如陪我去学校的心理中心，或者找专业的医生聊一聊。',
      '很感谢你愿意听我说到这里。',
      '（这是「心语伴」提供的一段参考文字，你可以按自己的情况改一改）'].join('\n');
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制，发给信任的人吧', icon: 'none' })
    });
  },

  call(e) {
    const number = e.currentTarget.dataset.number;
    if (!number) return;
    wx.makePhoneCall({ phoneNumber: number, fail: () => {} });
  },

  goBreathe() {
    wx.navigateTo({ url: '/pages/breathe/breathe' });
  },

  goScan() {
    wx.navigateTo({ url: '/pages/scan/scan' });
  },

  goStation() {
    wx.navigateTo({ url: '/pages/station/station' });
  },

  // 已安全回执：安排「温暖陪伴计划」——1 小时后 / 1 天 / 3 天 / 7 天，在陪伴页分阶段轻声回访
  checkSafe() {
    wx.showModal({
      title: '安排温柔回访',
      content: '心语会分四次来找你：1 小时后问问你现在好不好、一天后、三天后、还有七天后。像一位在后面陪着你走的朋友。可以吗？',
      confirmText: '好的',
      success: (r) => {
        if (!r.confirm) return;
        const now = Date.now();
        const H = 3600 * 1000;
        const plan = [{ t: now + 1 * H, s: 0 }, { t: now + 24 * H, s: 1 }, { t: now + 3 * 24 * H, s: 2 }, { t: now + 7 * 24 * H, s: 3 }];
        wx.setStorageSync('hbCarePlan', plan);
        if (!wx.getStorageSync('ach_care')) wx.setStorageSync('ach_care', true); // 成就：也请心语陪我
        this.setData({ safety: true });
        wx.showToast({ title: '已安排 4 次回访 🌱', icon: 'success' });
      }
    });
  },

  // ---- 我撑过来了：5 步自助 ----
  selfStart() {
    wx.removeStorageSync('selfCareProgress'); // 重新开始 = 放弃旧存档
    this._resume = null;
    this.setData({ selfStep: 0, selfInput: '', selfAnswers: [], selfResumeStep: 0 });
  },

  // 接着上次的存档继续走（答案原样带回）
  selfResume() {
    const p = this._resume;
    if (!p) return;
    this.setData({ selfStep: p.step, selfInput: p.input || '', selfAnswers: p.answers || [] });
  },

  onSelfInput(e) {
    this.setData({ selfInput: e.detail.value });
  },

  // 收起：界面归位，但存档保留，下次进来还能接着走
  selfClose() {
    this.setData({ selfStep: -1, selfInput: '', selfAnswers: [] });
    if (wx.getStorageSync('selfCareProgress')) {
      wx.showToast({ title: '已存档，下次接着走 🌱', icon: 'none' });
    }
  },

  selfNext() {
    const answers = this.data.selfAnswers || [];
    answers.push((this.data.selfInput || '').trim());
    if (this.data.selfStep < 4) {
      const next = this.data.selfStep + 1;
      this.setData({ selfStep: next, selfInput: '', selfAnswers: answers });
      // 每走一步都存档（step=下一步待填，answers=已答）
      wx.setStorageSync('selfCareProgress', { step: next, answers, input: '', ts: Date.now() });
    } else {
      // 完成：收尾存本地，清掉进度存档，轻轻给一句肯定
      const d = new Date();
      const pad = (n) => (n < 10 ? '0' + n : n);
      const last = {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        done: answers[answers.length - 1] || '（没想好也没关系，今天就先到这里）'
      };
      const hist = wx.getStorageSync('selfCareLog') || [];
      hist.push(last);
      if (hist.length > 5) hist.shift();
      wx.setStorageSync('selfCareLog', hist);
      wx.removeStorageSync('selfCareProgress');
      this._resume = null;
      this.setData({ selfStep: -1, selfInput: '', selfAnswers: [], selfLast: last, selfResumeStep: 0 });
      wx.showToast({ title: '收尾成功，辛苦了 🌱', icon: 'none' });
    }
  },

  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); }
});