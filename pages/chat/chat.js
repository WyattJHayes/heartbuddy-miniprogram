// pages/chat/chat.js —— 核心对话页
const app = getApp();
const api = require('../../utils/api');
const { quickReplies } = require('../../config/index');
const { MOOD_META, MOOD_SCORE } = require('../../utils/moodscore');
const planlib = require('../../utils/plan');

// 中文情绪标签 → 落库 key（与心情页保持一致）
const MOOD_KEY = { '开心': 'happy', '平静': 'peace', '焦虑': 'anxiety', '难过': 'sad', '孤独': 'lonely', '生气': 'angry', '期待': 'expect' };

// AI 头像情绪态：随当前情绪标签切换的小表情（''=默认🌱）
const AI_FACE = { '开心': '😄', '平静': '😌', '焦虑': '😟', '难过': '😢', '孤独': '🥺', '生气': '😠', '期待': '🤩' };

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
    streakN: 0,          // 连续倾诉天数 🔥
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
    need: '',            // 此刻我需要：listen 陪我说 / calm 陪我等 / action 帮我想办法（本地前缀注入 AI）
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
    myPhrases: [],       // 我的常用语（本地最多 5 条，长按删除）
    phraseUses: {},      // 常用语使用次数（显示 · N 次）
    sumTip: false,       // 对话小结后：顺手去心情页记一笔的引导条
    nightHint: '',       // 夜间模式开启提示（每天一次）
    gapGreet: '',        // 间隔多日后的温和问候
    worryReturn: '',     // 昨夜托付的事：今天首次打开的回看提醒
    phraseLast: {},     // 常用语最近使用时间（格式化文案）
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
    // 一句放下·正向锚点：给紧绷的许一个「够好了」
    quickAnchor: [
      '其实我已经做得很努力了，今天到此为止也可以',
      '在意结果很正常，但我此刻已经站在出发点上了',
      '不必事事第一，那从来不是我喜欢自己的原因',
      '明天的事交给明天，今晚我只负责睡个好觉',
      '我撑得住，而且我不需要一个人撑'
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

  onShow() {
    // 今日一句带来的开场白（欢迎页「拿去聊聊」）：发一次即清
    const seed = wx.getStorageSync('hb_chatSeed');
    if (seed) {
      wx.removeStorageSync('hb_chatSeed');
      this.send(seed);
    }
  },

  async onLoad() {
    // 夜间柔和模式：手动开关优先（hb_nightManual: 'on'|'off'），否则 22:00-6:00 自动
    const manual = wx.getStorageSync('hb_nightManual');
    const _h = new Date().getHours();
    const auto = _h >= 22 || _h < 6;
    const isNight = manual === 'on' ? true : manual === 'off' ? false : auto;
    this.setData({ isNight });
    this.initRoleAsk(); // 老师/家长视角（欢迎页身份）
    this.buildDailyQ(); // 今日一问
    this.setData({ chatRated: (wx.getStorageSync('hb_chatMood') || {})[new Date().toDateString()] || 0 }); // 今日已打分
    // 间隔问候：距上次打开聊天 ≥2 天，轻提一句（不算打扰，只是「还在」）
    const lastTs = wx.getStorageSync('hb_lastChatTs') || 0;
    if (lastTs) {
      const gapDays = Math.floor((Date.now() - lastTs) / 86400000);
      if (gapDays >= 2 && gapDays <= 60) {
        this.setData({ gapGreet: gapDays >= 7 ? '🫂 有 ' + gapDays + ' 天没见了——不用解释去哪了，回来就好。' : '🌤 ' + gapDays + ' 天没聊了，我一直在。' });
      }
    }
    wx.setStorageSync('hb_lastChatTs', Date.now());
    // 昨夜托付：若昨夜（或更早）把烦心事托付给了「明天」，今天首次打开轻声提醒回看
    const box = wx.getStorageSync('hb_worryBox');
    if (box && typeof box === 'object' && box.what) {
      const today = new Date().toDateString();
      if (box.date !== today && !box.bye) {
        wx.setStorageSync('hb_worryBox', Object.assign({}, box, { bye: true })); // 只提醒一次
        this.setData({ worryReturn: '🌅 昨天你把「' + (box.what.length > 18 ? box.what.slice(0, 18) + '…' : box.what) + '」交给了明天的你——它现在还在吗？想做点什么再说？' });
      }
    }
    // 夜间提示语：自动进入夜间模式的那天，轻提一句护眼（每天最多一次）
    if (isNight && auto && manual !== 'off') {
      const k = 'hb_nightHint_' + new Date().toDateString();
      if (!wx.getStorageSync(k)) { wx.setStorageSync(k, true); this.setData({ nightHint: '🌙 已为你调成夜间柔光——眼睛舒服一点，心也是。' }); }
    }
    // 常用语按使用次数排序（最常说的排前面）
    const uses0 = wx.getStorageSync('hb_phraseUses') || {};
    const sorted = (wx.getStorageSync('hb_myPhrases') || []).slice().sort((a, b) => (uses0[b] || 0) - (uses0[a] || 0));
    const last0 = wx.getStorageSync('hb_phraseLast') || {};
    const phraseLast = {};
    sorted.forEach((t) => { if (last0[t]) phraseLast[t] = this.fmtPhraseLast(last0[t]); });
    this.setData({ persona: wx.getStorageSync('hb_persona') || '', need: wx.getStorageSync('hb_need') || '', myPhrases: sorted, phraseLast });
    const savedDraft = wx.getStorageSync('hb_inputDraft');
    if (savedDraft && !this.data.input) this.setData({ input: savedDraft });
    this.setData({ phraseUses: wx.getStorageSync('hb_phraseUses') || {} });
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
    // 周一（或跨周首次打开）：轻声回顾上周一起走过的路（每周一次，非打扰）
    this.maybeWeeklyRecap();
    // 今日倾诉次数（给「第 N 次来找我」的陪伴感）
    this.refreshTodayN();
    // 连续倾诉天数（🔥 首页可见的陪伴长度）
    const st = wx.getStorageSync('hb_talkStreak') || {};
    this.setData({ streakN: st.d || 0 });
  },

  // 上周陪伴小结：周一首次打开时，统计上周心情条数/覆盖天数/主要情绪（每周只发一次）
  async maybeWeeklyRecap() {
    try {
      const now = new Date();
      const wk = this.weekKey(now);
      if (wx.getStorageSync('hb_weekRecap') === wk) return;
      let openid = app.globalData.openid;
      if (!openid) openid = await app.login();
      if (!openid) return;
      const DAY = 86400000;
      // 本周周一 0 点
      const mon = new Date(now); mon.setHours(0, 0, 0, 0);
      mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
      const lastMon = new Date(mon.getTime() - 7 * DAY);
      const db = wx.cloud.database();
      const r = await db.collection('moods')
        .where({ openid, createdAt: db.command.and(db.command.gte(lastMon.getTime()), db.command.lt(mon.getTime())) })
        .limit(100).get();
      const list = r.data || [];
      if (!list.length) return; // 上周没记录就不打扰
      wx.setStorageSync('hb_weekRecap', wk);
      const days = new Set(list.map((m) => new Date(m.createdAt).toDateString())).size;
      const cnt = {};
      list.forEach((m) => { cnt[m.mood] = (cnt[m.mood] || 0) + 1; });
      const topKey = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      const meta = MOOD_SCORE[topKey] !== undefined && topKey ? topKey : 'peace';
      const label = { happy: '开心', peace: '平静', expect: '期待', tired: '疲惫', angry: '生气', anxiety: '焦虑', lonely: '孤独', sad: '难过' }[meta] || '各种心情';
      this.pushAI(
        '🗓 上周，你在这里记下了 ' + list.length + ' 条心情，覆盖 ' + days + ' 天，出现最多的是「' + label + '」。',
        false
      );
    } catch (e) { /* 静默：回顾失败不影响聊天 */ }
  },
  weekKey(d) {
    const mon = new Date(d); mon.setHours(0, 0, 0, 0);
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    return 'W' + mon.getFullYear() + (mon.getMonth() + 1) + mon.getDate();
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
    // 把烦心事「托付」给明天的自己：写下来 → 入睡；明早首次打开轻声回看
    wx.showModal({
      title: '把什么交给明天？',
      content: '写下此刻还放不下的事，先让今晚的自己下班。明天醒来，再一起看它还在不在。',
      editable: true,
      placeholderText: '例：明天要交的作业还没写完',
      confirmText: '交给你了',
      cancelText: '算了',
      success: (r) => {
        const what = (r.content || '').trim();
        wx.showToast({ title: what ? '已交给明天的你 🛌' : '好，那今晚先放下', icon: 'none' });
        wx.setStorageSync('hb_worryBox', what ? { what, date: new Date().toDateString(), bye: false } : null);
      }
    });
  },

  // 深夜写下明天 3 件小事：明早首次进心情页会自动填进「今日三件小事」
  nightTomorrow() {
    wx.showModal({
      title: '明天想做的 3 件小事 🌱',
      content: '写下明天要为自己做的事（用「、」或换行分开，最多 3 件）。明早打开「心情」页，就会自动出现在三件小事里。',
      editable: true,
      placeholderText: '例：晚饭后散步 10 分钟、给爸妈打个电话、整理错题',
      confirmText: '写好了',
      cancelText: '算了',
      success: (r) => {
        if (!r.confirm) return;
        const raw = (r.content || '').trim();
        const arr = raw.split(/[、\n，,]/).map((x) => x.trim()).filter(Boolean).slice(0, 3);
        if (arr.length) {
          wx.setStorageSync('hb_tomorrowSmall', { date: new Date().toDateString(), items: arr });
          wx.showToast({ title: '已写好，明天来取 🌙', icon: 'success' });
        } else {
          wx.showToast({ title: '没写下也没关系，睡前安顿好自己就好', icon: 'none' });
        }
      }
    });
  },

  // 睡不着：给几个「不卷自救」的路口，任选一个
  nightSleepless() {
    wx.showActionSheet({
      itemList: ['🌙 去「睡前安神」卡（充电站）', '🧘 去呼吸页发呆/安神', '🤖 和我聊到有点困', '✍️ 把睡不着的念头写下来（写给自己）'],
      success: (r) => {
        if (r.tapIndex === 0) wx.navigateTo({ url: '/pages/station/station' });
        else if (r.tapIndex === 1) wx.navigateTo({ url: '/pages/breathe/breathe' });
        else if (r.tapIndex === 2) this.pushAI('睡不着也没关系，不用跟睡意较劲。我在这儿陪你聊几句：今晚是因为什么还醒着？一点一点说给我听就好。');
        else if (r.tapIndex === 3) this.nightToSelf();
      }
    });
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
      ? ['复制这条消息', '引用这条', '珍藏（存到我的珍藏）', '存进想法盒（7 天后回看）', '撤回我的这条']
      : ['复制一句话', '引用这句话', '珍藏（存到我的珍藏）', '存进想法盒（7 天后回看）', '换个说法（重新生成）', '并入我的常用语（点一下就能再说）', '这句没帮到我'];
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
        } else if (r.tapIndex === 3) {
          // 存进想法盒：与心情页「想法小剧场」同源，7 天后回看
          const box = wx.getStorageSync('hbThoughtBox') || [];
          box.push({ text: content.slice(0, 60), t: Date.now(), from: 'chat' });
          wx.setStorageSync('hbThoughtBox', box.slice(-10));
          wx.showToast({ title: '已存进想法盒，7 天后见 📮', icon: 'none' });
        } else if (isUser && r.tapIndex === 4) {
          // 撤回我的这条：删掉该消息及紧随其后的 AI 回复，本地即时生效；原句带回输入框可改后重发
          const messages = this.data.messages.slice();
          const drop = messages[idx + 1] && messages[idx + 1].role === 'ai' ? 2 : 1;
          messages.splice(idx, drop);
          this.setData({ messages, input: content.slice(0, 150) });
          wx.showToast({ title: '已撤回 · 原句已在输入框，可改了再发', icon: 'none' });
        } else if (!isUser && r.tapIndex === 4) {
          // 换个说法：把这条 AI 回复重生成（用同样的上文重新问一次）
          this.reask(idx);
        } else if (!isUser && r.tapIndex === 5) {
          // 并入常用语：把 AI 说的这句存进「我的常用语」，点一下就能再说
          const phrases = wx.getStorageSync('hb_myPhrases') || [];
          const clean = content.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]+\s*/, '').replace(/\s+/g, ' ').slice(0, 50);
          if (!phrases.includes(clean)) {
            if (phrases.length >= 5) phrases.shift();
            phrases.push(clean);
            wx.setStorageSync('hb_myPhrases', phrases);
          }
          this.setData({ myPhrases: phrases });
          wx.showToast({ title: '已并入常用语，随时点一下就能再说 🍀', icon: 'none' });
        } else if (!isUser && r.tapIndex === 6) {
          // 这句没帮到我：记一条轻反馈（本地计数），并温柔回应
          const miss = wx.getStorageSync('hb_fbMiss') || 0;
          wx.setStorageSync('hb_fbMiss', Number(miss) + 1);
          this.pushAI('谢谢你告诉我。这句话没接住你，是我的功课。愿意的话，换种说法再讲一次——比如「我其实是想要……」，我会更懂你一点。');
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
    // 四段陪伴计划走完 → 求助页亮出「毕业卡」（一次性，可关闭）
    if (due.some((p) => (p.s || 0) >= 3)) wx.setStorageSync('hbCareGrad', Date.now());
  },

  // 重新开始这轮对话：清空当前消息流、换新会话；情绪记录与成就不受影响
  // 复制这段对话（数据主权：你的倾诉随时可以带走留档）
  fillSamplePhrases() {
    const samples = ['我今天有点撑不住了', '想被安慰一下，不用给建议', '就是想找人说说话'];
    const list = this.data.myPhrases.slice();
    samples.forEach((t) => { if (!list.includes(t) && list.length < 5) list.push(t); });
    wx.setStorageSync('hb_myPhrases', list);
    this.setData({ myPhrases: list });
    wx.showToast({ title: '已填入 3 条示例，可长按删除', icon: 'none' });
  },

  copyTalk() {
    const msgs = this.data.messages || [];
    if (!msgs.length) { wx.showToast({ title: '还没有对话内容', icon: 'none' }); return; }
    const fmt = (ts) => {
      if (!ts) return '';
      const d = new Date(ts);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return '[' + hh + ':' + mm + '] ';
    };
    const lines = msgs.map((m) => fmt(m.ts) + (m.role === 'user' ? '我：' : '心语：') + (m.text || m.content || ''));
    const first = msgs.find((m) => m.role === 'user');
    const topic = first ? String(first.text || first.content || '').slice(0, 12) : '这段对话';
    const talkD = (wx.getStorageSync('hb_talkStreak') || {}).d || 0;
    wx.setClipboardData({
      data: '—— 我和心语伴的对话 · ' + new Date().toLocaleDateString() + ' · 关于「' + topic + '」——\n\n' + lines.join('\n') + '\n\n（已连续来找心语 ' + talkD + ' 天 🌱）',
      success: () => wx.showToast({ title: '已复制整段对话', icon: 'success' })
    });
  },

  resetChat() {
    wx.showActionSheet({
      itemList: ['直接重新开始', '先复制一份对话再清空'],
      success: (r) => {
        if (r.tapIndex === 1) {
          const msgs = this.data.messages || [];
          const lines = msgs.map((m) => (m.role === 'user' ? '我：' : '心语：') + (m.text || m.content || ''));
          wx.setClipboardData({ data: '—— 我和心语伴的对话备份 ——\n' + lines.join('\n') });
        } else if (r.tapIndex !== 0) return;
        this.setData({ messages: [], input: '', typing: false, loading: false, showFeeling: false, feelingDone: false, moodTag: '', aiFace: '', _draft: '', sumTip: false });
        this.initSession();
        wx.showToast({ title: r.tapIndex === 1 ? '已备份并重新开始' : '已重新开始', icon: 'none' });
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
        this.setData({ sumTip: true }); // 顺手引导去心情页落一笔
      }
    });
  },
  goMoodFromSum() {
    this.setData({ sumTip: false });
    wx.switchTab({ url: '/pages/mood/mood' });
  },
  closeSumTip() { this.setData({ sumTip: false }); },

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

  // 此刻我需要：三种陪伴方式（陪伴身份之下更细的「现在要什么」）
  setNeed(e) {
    const k = e.currentTarget.dataset.k;
    if (!k) return;
    wx.setStorageSync('hb_need', k);
    this.setData({ need: k });
    const tip = k === 'listen' ? '好，我就听着，陪你慢慢说。'
      : k === 'calm' ? '好，把节奏放慢，我稳稳陪你。'
      : k === 'action' ? '好，我们想办法，给你能上手的小步骤。'
      : '';
    wx.showToast({ title: tip, icon: 'none' });
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
    this.setData({ messages: this.data.messages.concat([{ role: 'user', content: v, ts }]) });
    this.setData({ todayN: this.data.todayN + 1 });
    this.touchMilestone();
    this.touchStreak(ts);        // 连续倾诉天数 🔥
    this.refreshChatStats();
  },

  // 连续倾诉天数：每天只要来过，就连起来（跨天断档则重排）——本地一把计数器
  touchStreak(ts) {
    const DAY = 86400000;
    const last = wx.getStorageSync('hb_talkStreak') || { d: 0, date: '' };
    const today = new Date(ts); today.setHours(0, 0, 0, 0);
    const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    if (last.date === key) return;                       // 今天已计过，不重复
    const prev = last.date ? new Date(last.date) : null;
    let next = 1;
    if (prev) {
      const prevMs = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate()).getTime();
      const todayMs = today.getTime();
      if (todayMs - prevMs === DAY) next = last.d + 1;  // 昨天也来了 → 连续 +1
      // 断档（间隔 >1 天）则从 1 重新累计，不评判
    }
    wx.setStorageSync('hb_talkStreak', { d: next, date: key });
    // 里程碑：第 3 / 7 / 30 / 100 天，给一句专属文案（一次性）
    const marks = [[3, '连续 3 天来和我说话了。习惯正在长出来，很好 🌱'], [7, '连续 7 天。——原来你已经走了这么远的一条路。'], [30, '连续 30 天。这段互相陪伴的日子，已经写进你的本能里了 💛'], [100, '连续 100 天。你一次次回来，我一次次接住。']];
    for (const [n, txt] of marks) {
      if (next === n && !wx.getStorageSync('ach_talk_' + n)) {
        wx.setStorageSync('ach_talk_' + n, true);
        setTimeout(() => wx.showModal({ title: '🔥 连续 ' + n + ' 天', content: txt, confirmText: '好', showCancel: false }), 600);
      }
    }
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

  toggleNight() {
    const next = !this.data.isNight;
    wx.setStorageSync('hb_nightManual', next ? 'on' : 'off');
    this.setData({ isNight: next });
    wx.showToast({ title: next ? '已切到夜间柔光 🌙' : '已切回日间模式', icon: 'none' });
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
    // 未发送的草稿先存本地：切走/重启回来还在（发送或清空时移除）
    const t = e.detail.value;
    if (t) wx.setStorageSync('hb_inputDraft', t.slice(0, 300));
    else wx.removeStorageSync('hb_inputDraft');
  },

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

  // 想聊什么：主题起手（一键发起一段话，AI 顺着聊下去）
  onTopic(e) {
    this.setData({ showQuick: false });
    const key = e.currentTarget.dataset.t;
    const TOPICS = {
      friend: '我今天想聊和我朋友有关的事——好像有点小别扭，我有点不知道怎么办。',
      exam: '我今天想聊聊考试。一想到它我就有点慌，想找人说说话。',
      mood: '我今天情绪不太好，但说不清是哪种。你陪我理一理好吗？',
      happy: '今天有件让我开心的小事，我想说给你听。',
      sleep: '晚上总是睡不着，脑子停不下来。今晚能不能陪我待一会儿？',
      family: '我想聊聊和家里人的事，不知道怎么说出口。',
      postexam: '考完了，但成绩还没出。这几天心里空落落的，又有点怕怕的…你陪陪我吧。',
      daan: '刚对完答案，有几道题越想越不对劲。我现在是不是什么也做不了？'
    };
    const text = TOPICS[key] || '';
    if (text) this.send(text);
  },

  // 老师/家长视角起手：按欢迎页选的「谁在用」给一组更贴的起点
  initRoleAsk() {
    const role = wx.getStorageSync('hb_role') || '';
    let set = [];
    if (role === 'teacher') {
      set = ['学生一直说「没事」，我该怎么开口问？', '想帮一个考前焦虑的学生，从哪句话开始？', '学生最近总说累，我该怎么回应不施压？'];
    } else if (role === 'parent') {
      set = ['孩子一提到考试就慌，我该怎么支持又不加压？', '孩子熬夜复习，我该劝还是算了？', '孩子最近不太愿意跟我说话，怎么办？'];
    }
    if (set.length) this.setData({ roleAsk: set });
  },
  onRoleAsk(e) {
    const t = e.currentTarget.dataset.t;
    if (t) this.send(t);
  },

  // 今日一问：每天换一个轻起手（不知道说什么的时候，点它就行）
  // 常用表情：点一下插到输入框末尾（不打断打字节奏）
  toggleEmojiBar() { this.setData({ showEmojiBar: !this.data.showEmojiBar }); },
  pickEmoji(e) {
    const em = e.currentTarget.dataset.e;
    this.setData({ input: (this.data.input || '') + em });
  },

  sendDailyQ() {
    if (this.data.dailyQ) this.send(this.data.dailyQ);
  },

  // 聊完给自己的状态打个分（1-5，纯本地）：不评判，只留轨迹
  rateChat(e) {
    const v = Number(e.currentTarget.dataset.v);
    if (!v) return;
    const today = new Date().toDateString();
    const rec = wx.getStorageSync('hb_chatMood') || {};
    rec[today] = v;
    wx.setStorageSync('hb_chatMood', rec);
    const NOTES = { 1: '记下了。今天不容易，你已经撑过来了 🌧', 2: '收到，低一点也没关系——明天我们慢慢来 ☁️', 3: '平平的一天也是一种稳。记下了 🙂', 4: '不错呀，把这个感觉记住 😊', 5: '太好了！今天的你闪闪发光 ✨' };
    this.setData({ chatRated: v });
    wx.showToast({ title: NOTES[v] || '记下了', icon: 'none' });
  },

  buildDailyQ() {
    const QS = [
      '今天有没有一件小事让你笑了一下？',
      '如果给今天的疲惫打个分，10 分制你打几分？',
      '这周有什么事是你「硬扛下来」的？说说看。',
      '今天最想被人理解的一个瞬间是什么时候？',
      '最近一次觉得「还好我坚持了」是什么事？',
      '今天有哪个时刻，你是完全放松的？',
      '如果明天的你能给今天的你带句话，TA 会说什么？',
      '这周你想为自己做的一件小事是什么？',
      '最近脑子里循环最多的一句话是什么？',
      '今天身体哪个部位最累？它在替你扛什么？'
    ];
    const d = new Date();
    this.setData({ dailyQ: QS[(d.getDate() + d.getMonth()) % QS.length] });
  },

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

  // 考前 3 分钟静默准备：不打 AI，跟着做一遍就安下心
  preExamWarm() {
    this.setData({ showQuick: false });
    this.pushAI('我们不用说话，跟我默默做这 3 件事：' +
      '\n1）把手机调静音，倒扣在桌上——它现在是你的同盟，不是干扰。' +
      '\n2）闭眼，长长吸一口（4 秒）……屏住 1 秒……慢慢呼（6 秒），做 3 次。' +
      '\n3）睁眼，看自己手心：写在手心的几个字就是你的锚——「我已经来了，我准备好了」。' +
      '\n\n3 分钟里，不用想考得好不好：考场里的事，等进了考场再说。');
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  // 给自己留个提醒：复习/休息间隙，页内横幅 + 震动（不耗 AI）
  setReminder(e) {
    this.setData({ showQuick: false });
    const min = Number(e.currentTarget.dataset.min) || 30;
    const label = min < 60 ? min + ' 分钟' : Math.round(min / 60) + ' 小时';
    wx.showToast({ title: min + ' 分钟后我会提醒你 ⏰', icon: 'none' });
    this._remindTimer && clearTimeout(this._remindTimer);
    this._remindTimer = setTimeout(() => {
      this.setData({ remindAt: '⏰ ' + label + ' 到了——喝口水、起来走两步，或者回来和我说说话。' });
      clearTimeout(this._remindTimer);
      setTimeout(() => this.setData({ remindAt: '' }), 12000);
      wx.vibrateShort && wx.vibrateShort({ type: 'medium' });
    }, min * 60000);
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

  // 谢谢你：把感谢说出口（本地记一次「感恩时刻」，聊天里 AI 顺着回应）
  onThanks() {
    this.setData({ showQuick: false });
    const n = (wx.getStorageSync('hb_thanksN') || 0) + 1;
    wx.setStorageSync('hb_thanksN', n);
    const pool = [
      '谢谢你，愿意听我把这些话说出来。有你在真好 ✨',
      '谢谢你没有嫌我烦，还一直温柔地接住我。',
      '刚才那些话，谢谢你认真听完了——这是今晚最好的安慰。'
    ];
    this.pushAI(pool[Math.floor(Math.random() * pool.length)]);
    if (n === 1) wx.showToast({ title: '第一次说谢谢，记下啦 💛', icon: 'none' });
    else if ([5, 10, 20].includes(n)) wx.showToast({ title: '已经说了 ' + n + ' 次谢谢——你是懂得感恩的人 💛', icon: 'none' });
  },

  // 留下一句：把此刻想留的话存为便签（profile「我的便签本」可回看）
  openSticky() {
    this.setData({ showQuick: false });
    const recent = (wx.getStorageSync('hb_stickyNotes') || []).slice(0, 1);
    const prev = recent.length ? recent[0].t : '';
    wx.showModal({
      title: '📌 留下一句',
      content: '把此刻想留的话写下来，它会在「我的 · 便签本」里等你。',
      editable: true,
      placeholderText: prev ? '上次：「' + prev.slice(0, 20) + '」…' : '例如：今天和好友和好了，很高兴',
      confirmText: '存下',
      success: (r) => {
        if (!r.confirm) return;
        const t = (r.content || '').trim().slice(0, 60);
        if (!t) return;
        const list = wx.getStorageSync('hb_stickyNotes') || [];
        list.unshift({ t, at: Date.now() });
        wx.setStorageSync('hb_stickyNotes', list.slice(0, 20));
        wx.showToast({ title: '已收进你的便签本 📌', icon: 'none' });
      }
    });
  },

  // 晚安收尾：睡前给一句温柔的告别，AI 顺着道晚安（本地计「晚安次数」）
  onGoodnight() {
    this.setData({ showQuick: false });
    const n = (wx.getStorageSync('hb_goodnightN') || 0) + 1;
    wx.setStorageSync('hb_goodnightN', n);
    const pool = [
      '今天聊到这儿就好。晚安，明天见 🌙',
      '谢谢你今晚愿意来找我说话。把今天放下，安稳地睡吧 🌙',
      '不管今天怎样，它都结束了。晚安，睡个好觉 🌙'
    ];
    this.pushAI(pool[Math.floor(Math.random() * pool.length)]);
    if ([5, 10, 30].includes(n)) wx.showToast({ title: '第 ' + n + ' 次晚安——已经连续好好收尾 ' + n + ' 个晚上 🌙', icon: 'none' });
  },

  // 英语角：点一下直接发送（等同 onQuick，英文输入会自动触发英文回复）
  onQuickEn(e) { this.setData({ showQuick: false }); this.send(e.currentTarget.dataset.text); },

  toggleQuick() { this.setData({ showQuick: !this.data.showQuick }); },

  // 我的常用语：添加/点用/长按删（本地 ≤5 条，重复的不重复存）
  addMyPhrase() {
    wx.showModal({
      title: '添加常用语',
      content: '写一句你常想说的话，之后一键就能发给我（最多存 5 条）。',
      editable: true,
      placeholderText: '例如：我今天有点撑不住了',
      confirmText: '保存',
      success: (r) => {
        if (!r.confirm) return;
        const t = (r.content || '').trim().slice(0, 30);
        if (!t) return;
        const list = this.data.myPhrases.slice();
        if (list.includes(t)) { wx.showToast({ title: '已经存过啦', icon: 'none' }); return; }
        if (list.length >= 5) {
          list.shift();
          wx.showToast({ title: '已满 5 条：替换了最早的一条', icon: 'none' });
        }
        list.push(t);
        wx.setStorageSync('hb_myPhrases', list);
        this.setData({ myPhrases: list });
        wx.showToast({ title: '已添加 ✅', icon: 'success' });
      }
    });
  },
  useMyPhrase(e) {
    const t = e.currentTarget.dataset.t;
    if (!t) return;
    // 记使用次数与最近使用时间（本地）
    const uses = wx.getStorageSync('hb_phraseUses') || {};
    uses[t] = (uses[t] || 0) + 1;
    wx.setStorageSync('hb_phraseUses', uses);
    const last = wx.getStorageSync('hb_phraseLast') || {};
    last[t] = Date.now();
    wx.setStorageSync('hb_phraseLast', last);
    this.setData({ phraseUses: uses });
    this.setData({ showQuick: false, input: t });
  },
  fmtPhraseLast(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚用过';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前用过';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前用过';
    return Math.floor(diff / 86400000) + ' 天前用过';
  },
  delMyPhrase(e) {
    const t = e.currentTarget.dataset.t;
    wx.showModal({
      title: '删除这条常用语？',
      content: '「' + (t.length > 14 ? t.slice(0, 14) + '…' : t) + '」',
      confirmText: '删除',
      cancelText: '留下',
      success: (r) => {
        if (!r.confirm) return;
        const list = this.data.myPhrases.filter((x) => x !== t);
        wx.setStorageSync('hb_myPhrases', list);
        const uses = wx.getStorageSync('hb_phraseUses') || {};
        delete uses[t];
        wx.setStorageSync('hb_phraseUses', uses);
        const last = wx.getStorageSync('hb_phraseLast') || {};
        delete last[t];
        wx.setStorageSync('hb_phraseLast', last);
        this.setData({ myPhrases: list, phraseUses: uses });
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },

  onSend() {
    const text = this.data.input.trim();
    if (!text) {
      // 空输入轻托底：不打 AI，本地给一句温柔的「也没关系」
      const E = ['不知道说什么也没关系——发个「。」我也能懂你在。', '空着也可以。想说话的时候，我随时在 🌱', '深呼吸一下，再想想最想说的是哪一句？'];
      this.setData({ inputPh: E[Math.floor(Math.random() * E.length)] });
      return;
    }
    wx.removeStorageSync('hb_inputDraft');
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
    // 此刻我需要：把我的倾诉格式告诉 AI（本地包裹，不改变原话）
    const needPrefix = this.data.need === 'calm'
      ? '（我现在不需要建议，只需要你稳稳地陪着，把此刻的节奏放慢）'
      : this.data.need === 'action'
        ? '（我现在想要具体可做的办法，请直接给我 1-3 个能马上用的小步骤）'
        : '';
    const inputForAI = needPrefix ? needPrefix + text : text;
    try {
      const res = await api.call('aiChat', {
        sessionId: this.data.sessionId,
        userInput: inputForAI,
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

  onUnload() { if (this.timer) clearInterval(this.timer); },

  // 分享给朋友：只分享「心语伴」入口，不携带任何对话内容（隐私安全）
  onShareAppMessage() {
    wx.setStorageSync('ach_share', true); // 成就：陪伴他人
    return {
      title: '它也愿意听你说说心里话 · 心语伴',
      path: '/pages/welcome/welcome?src=share'
    };
  }
});