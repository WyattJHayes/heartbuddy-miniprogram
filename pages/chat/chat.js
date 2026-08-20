// pages/chat/chat.js —— 核心对话页
const app = getApp();
const api = require('../../utils/api');
const { quickReplies } = require('../../config/index');
const { MOOD_META } = require('../../utils/moodscore');

// 中文情绪标签 → 落库 key（与心情页保持一致）
const MOOD_KEY = { '开心': 'happy', '平静': 'peace', '焦虑': 'anxiety', '难过': 'sad', '孤独': 'lonely', '生气': 'angry' };

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
    messages: [],        // [{ role: 'user'|'ai', content }]
    input: '',
    moodTag: '',         // 当前可选的情绪标签
    typing: false,       // AI 打字中
    typedText: '',
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
    // 新手引导（一次性）
    onboarding: false,
    onboardingStep: 0,
    weatherIco: '',   // ☀️/☁️/🌧…
    weatherText: '',   // "10:00 · 晴 · 24℃"（免费 open-meteo，无 key）
    dailyQuote: '',    // 今日心语（日轮换，可点复制）
    nightShow: false  // 深夜（22:00–5:00）显示深夜工具箱
  },

  async onLoad() {
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
    // 天气角（免费 open-meteo，定位失败静默降级为默认城市）
    this.loadWeather();
    // 耐心等登录完成（拿到 isNewUser 才能定制首次欢迎语；失败也不阻塞，用常规欢迎语兜底）
    await app.login().catch(() => {});
    this.initSession();
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
  nightWrite() { wx.switchTab({ url: '/pages/mood/mood' }); },
  nightLater() {
    wx.showToast({ title: '把烦心事留给明天的你吧，先去睡 🛌', icon: 'none' });
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

  // ---- 消息长按：复制 / 珍藏 ----
  onMsgLongPress(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const item = this.data.messages[idx];
    if (!item) return;
    const content = item.content || '';
    wx.showActionSheet({
      itemList: ['复制这条消息', '珍藏（存到我的珍藏）'],
      success: (r) => {
        if (r.tapIndex === 0) {
          wx.setClipboardData({ data: content, success: () => wx.showToast({ title: '已复制', icon: 'none' }) });
        } else if (r.tapIndex === 1) {
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
        }
      }
    });
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
    // 上午（5–11 点）今天还没记录心情时，轻轻提醒一次（每天仅一次）
    const todayKey = new Date().toDateString();
    if (hour >= 5 && hour < 11
        && wx.getStorageSync('hb_lastMoodDate') !== todayKey
        && wx.getStorageSync('hb_nudgeMorning') !== todayKey) {
      wx.setStorageSync('hb_nudgeMorning', todayKey);
      greeting = greeting.replace(/。$/, '') + '。今天还没记录过心情，花 5 秒记下就好 🌅';
    }
    const sessionId = String(Date.now());
    this.setData({ sessionId });
    this.setAI(5); // 初始会话 ID 就绪后可向云函数获取历史；MVP 简化为固定 ID
    this.pushAI(greeting, false);
    this.maybeCheckIn();
  },

  // 危机回访：helper 页设置过 24h 回执，到期后在会话里温柔问候一次（一次性）
  maybeCheckIn() {
    const ts = wx.getStorageSync('crisisCheck');
    if (!ts || ts > Date.now()) return;
    wx.removeStorageSync('crisisCheck');
    this.pushAI("已经过去一天了哦。你现在感觉怎么样？无论有没有好一点，都允许自己慢慢来。想聊的话我一直都在 🌱", false);
  },

  setAI(timeout) {
    // 预留：从云端恢复历史会话可在此实现
  },

  pushAI(content, type = true) {
    this.setData({ messages: this.data.messages.concat([{ role: 'ai', content }]), typing: true });
    this.typewriter(content);
  },

  pushUser(content) {
    this.setData({ messages: this.data.messages.concat([{ role: 'user', content }]) });
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
      } else {
        this.setData({ typedText: fullText.slice(0, i) });
      }
      this.scrollBottom();
    }, 30);
  },

  scrollBottom() {
    wx.createSelectorQuery()
      .select('#msgEnd')
      .boundingClientRect((rect) => {
        if (rect) wx.pageScrollTo({ scrollTop: rect.top + rect.height, duration: 200 });
      })
      .exec();
  },

  onInput(e) { this.setData({ input: e.detail.value }); },

  onMood(e) {
    const label = e.currentTarget.dataset.m;
    this.setData({ moodTag: label });
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
          intensity: 3,
          trigger: '聊天标签',
          createdAt: Date.now()
        }
      });
      if (!wx.getStorageSync('ach_firstRecord')) wx.setStorageSync('ach_firstRecord', true);
      wx.vibrateShort && wx.vibrateShort({ type: 'light' });
      wx.showToast({ title: '心情已记录，到心情页看曲线', icon: 'none' });
    } catch (e) {
      console.error('[chat] 心情落库失败', e);
    }
  },

  onQuick(e) { this.setData({ showQuick: false }); this.send(e.currentTarget.dataset.text); },

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
    this.pushUser(text);
    this.setData({ moodTag: '' });
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
        assessment: this.getLastAssessment()
      });
      const r = res.result || {};
      this.setData({ loading: false });
      this.pushAI(r.content || '我在，慢慢说。');

      // 危机分级响应（high 弹窗推送求助页 / mid 温和引导 / low 不打扰）
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