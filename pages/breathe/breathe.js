// pages/breathe/breathe.js —— 呼吸练习引导（纯本地、无网络）
const app = getApp();

// [阶段名, 时长ms, 目标尺寸(rpx), transition 秒]
// 呼吸节奏预设：默认 4-4-6；盒式 4-4-4-4；长呼 6-2-6-2（长缓缓呼更放松）
const PRESETS = [
  { key: 'calm', label: '放松 · 4-4-6', rounds: [['in', 3800, 460, 3.9], ['hold', 3200, 460, 0.6], ['out', 5600, 150, 5.6]] },
  { key: 'box', label: '盒式 · 4-4-4-4', rounds: [['in', 4000, 520, 4.1], ['hold', 4000, 520, 0.6], ['out', 4000, 150, 4.1], ['hold', 4000, 150, 0.6]] },
  { key: 'long', label: '长呼 · 6-2-6-2', rounds: [['in', 6000, 520, 6.1], ['hold', 2000, 520, 0.6], ['out', 6000, 150, 6.1], ['hold', 2000, 150, 0.6]] },
  { key: 'stare', label: '发呆 · 2 分钟', rounds: [['stare', 120000, 150, 2]] }
];
const DAILY_GOAL_MIN = 10; // 每日放松目标：累计 10 分钟（同一次约 5 分钟 → 两次达标）

const PH_TEXT = {
  in: '吸气……把空气慢慢填满',
  hold: '屏住呼吸',
  out: '呼气……放松肩膀',
  stare: '安静地待 2 分钟，什么都不用做……',
  done: '完成，做得很好'
};

Page({
  data: {
    phase: 'ready', // ready | in | hold | out | done
    round: 0,
    total: 4,
    ball: 150,
    trans: 0.5,
    text: '准备好了就开始',
    calm: false,
    calmInt: 3,          // 记录「平静」时的强度（1-5，默认 3）
    dayGoal: DAILY_GOAL_MIN, // 面向 WXML 展示
    echoText: '',          // 完成一次呼吸后的「呼吸回响」
    presets: PRESETS,
    presetKey: 'calm'
  },

  onLoad() {
    this._timers = [];
    this._stop = false;
    this._running = false;
    this._rounds = PRESETS[0].rounds;
  },

  // ---- 每日放松目标：累计分钟数 → 进度条 + 达标庆祝 + 连续天数（纯本地）----
  refreshDayGoal() {
    const today = new Date().toDateString();
    const d = wx.getStorageSync('hb_breatheDay');
    const cur = d && typeof d === 'object' && d.date === today ? d : { mins: 0, done: false };
    const st = wx.getStorageSync('hb_breatheStreak');
    this.setData({
      dayMins: cur.mins || 0,
      dayPct: Math.min(100, Math.round(((cur.mins || 0) / DAILY_GOAL_MIN) * 100)),
      dayDone: !!cur.done,
      dayStreak: (st && st.n) || 0
    });
  },

  touchDayGoal(addMin) {
    const today = new Date().toDateString();
    let d = wx.getStorageSync('hb_breatheDay');
    if (!d || typeof d !== 'object' || d.date !== today) {
      d = { date: today, mins: 0, done: false };
    }
    d.mins = Math.min((d.mins || 0) + addMin, DAILY_GOAL_MIN);
    d.done = d.mins >= DAILY_GOAL_MIN;
    wx.setStorageSync('hb_breatheDay', d);
    // 连击：达标才推进
    let st = wx.getStorageSync('hb_breatheStreak');
    if (!st || typeof st !== 'object') st = { date: '', n: 0 };
    const y = new Date(Date.now() - 86400000).toDateString();
    if (d.done && st.date !== today) {
      st = { date: today, n: (st.date === y ? st.n : 0) + 1 };
      wx.setStorageSync('hb_breatheStreak', st);
      if (st.n === 1) wx.setStorageSync('ach_breatheDay', true);
      if (st.n === 3 && !wx.getStorageSync('ach_breathe3day')) wx.setStorageSync('ach_breathe3day', true);
      setTimeout(() => {
        wx.showModal({
          title: '🌸 今日放松目标达成',
          content: `今天累计放松了 ${d.mins} 分钟。已经连续 ${st.n} 天做到了这样一件照顾自己的小事。`,
          showCancel: false,
          confirmText: '夸自己一下'
        });
      }, 350);
    }
    this.refreshDayGoal();
  },

  // 最近 7 次放松记录（breatheWeek 时间戳 → 日期+时刻，纯本地回看）
  buildRecentLog() {
    const ts = wx.getStorageSync('breatheWeek') || [];
    const arr = Array.isArray(ts) ? ts.slice(-7).reverse() : [];
    return arr.map((t) => {
      const d = new Date(t);
      const p = (n) => (n < 10 ? '0' + n : '' + n);
      return { day: `${d.getMonth() + 1}月${d.getDate()}日`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
    });
  },

  // 本周已展示（本地周计数，周一重置）
  // 呼吸回响：完成一次后温柔的一句（按完成次数轮换）
  nextEcho() {
    const pool = [
      '山有风，你慢慢吹；心已定，你慢慢来。',
      '吸——呼——这一口气，你赢回来了。',
      '你刚刚做了一件重要的小事：照顾自己。',
      '身体记得「此刻是安全的」，谢谢你的练习。',
      '回到自己身边的感觉，很好。',
      '不用一次做到最好，一次次来就够了。'
    ];
    const n = wx.getStorageSync('breatheCount') || 0;
    return pool[Math.max(0, n - 1) % pool.length];
  },

  weekCount() {
    const now = new Date();
    const wStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const t0 = wStart.getTime();
    const ts = (wx.getStorageSync('breatheWeek') || []);
    return (Array.isArray(ts) ? ts : []).filter((t) => t >= t0).length;
  },

  todayCount() {
    const t0 = new Date().setHours(0, 0, 0, 0);
    const ts = (wx.getStorageSync('breatheWeek') || []);
    return (Array.isArray(ts) ? ts : []).filter((t) => t >= t0).length;
  },

  onShow() {
    this.refreshDayGoal();
    this.setData({ recentLog: this.buildRecentLog() });
    // 累计练习次数展示条（本地计数）
    const count = wx.getStorageSync('breatheCount') || 0;
    const mins = (wx.getStorageSync('hb_breatheMins') || 0);
    const wk = this.weekCount();
    const td = this.todayCount();
    this.setData({ breatheCount: count, breatheMins: mins, breatheWeek: wk, breatheToday: td,
      lastDone: count ? `已累计练习 ${count} 次 · ${mins} 分钟 🌿` : '还没有练习记录，来一次吗？' });
  },

  onUnload() {
    this._stop = true;
    (this._timers || []).forEach((t) => clearTimeout(t));
  },

  // 切换呼吸节奏（未开始时生效；进行中会先结束当前练习）
  setPreset(e) {
    const key = e.currentTarget.dataset.key;
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    if (this._running) {
      this._stop = true;
      this._running = false;
      this._timers.forEach((t) => clearTimeout(t));
      this._timers = [];
    }
    this._rounds = p.rounds;
    this.setData({ presetKey: key, phase: 'ready', round: 0, ball: 150, trans: 0.5,
      text: '已选「' + p.label + '」，点击开始' + (key === 'stare' ? '安安静静待着' : '跟着节奏呼吸'), calm: false });
  },

  startStare() {
    if (this._running) return;
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
    this._running = true;
    this._stop = false;
    this.setData({ round: 1, stare: true, text: '安静地让 2 分钟过去，什么都不用做' });
    this._rounds = [['stare', 120000, 150, 0]];
    this.runRound(1, 0, 1);
  },

  start() {
    if (this.data.presetKey === 'stare') { this.startStare(); return; }
    if (this._running) return;
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
    this._running = true;
    this._stop = false;
    this.setData({ round: 1 });
    this.runRound(1, 0, this.data.total);
  },

  runRound(r, step, total) {
    if (this._stop) return;
    const rounds = this._rounds || PRESETS[0].rounds;
    const tot = total || this.data.total;
    if (step >= rounds.length) {
      if (r < tot) {
        this.runRound(r + 1, 0, tot);
      } else {
        this._running = false;
        this.setData({ phase: 'done', text: PH_TEXT.done });
      }
      return;
    }
    const [phase, ms, ball, trans] = rounds[step];
    this.setData({ round: r, phase, ball, trans, text: PH_TEXT[phase] });
    const timer = setTimeout(() => this.runRound(r, step + 1), ms);
    this._timers.push(timer);
  },

  // 结束后把此刻情绪记成「平静」（与心情页/曲线无缝联动）
  goScan() {
    wx.navigateTo({ url: '/pages/scan/scan' });
  },

  async recordCalm() {
    if (this.data.calm) return;
    this.setData({ calm: true });
    let openid = app.globalData.openid;
    if (!openid) openid = await app.login();
    if (openid) {
      try {
        const db = wx.cloud.database();
        await db.collection('moods').add({
          data: {
            openid,
            sessionId: 'breath-' + Date.now(),
            mood: 'peace',
            intensity: this.data.calmInt || 3,
            trigger: '呼吸练习',
            createdAt: Date.now()
          }
        });
        if (!wx.getStorageSync('ach_firstRecord')) wx.setStorageSync('ach_firstRecord', true);
        // 呼吸练习徽章：完成 1 次 / 累计 5 次
        const bc = (wx.getStorageSync('breatheCount') || 0) + 1;
        wx.setStorageSync('breatheCount', bc);
        const bm = (wx.getStorageSync('hb_breatheMins') || 0) + 5; // 每次约 5 分钟的平静
        wx.setStorageSync('hb_breatheMins', bm);
        this.setData({ breatheMins: bm });
        // 本周进度（时间戳队列，跨周自动重置）
        const wk = wx.getStorageSync('breatheWeek') || [];
        wk.push(Date.now());
        wx.setStorageSync('breatheWeek', wk);
        this.setData({ breatheWeek: this.weekCount(), breatheToday: this.todayCount() });
        this.touchDayGoal(5); // 每次约 5 分钟平静 → 累计到今日目标
        if (!wx.getStorageSync('ach_breathe')) wx.setStorageSync('ach_breathe', true);
        if (bc >= 5 && !wx.getStorageSync('ach_breathe5')) wx.setStorageSync('ach_breathe5', true);
        wx.vibrateShort && wx.vibrateShort({ type: 'light' });
        wx.showToast({ title: '已记下此刻的平静', icon: 'success' });
        this.setData({ echoText: this.nextEcho() });
      } catch (e) {
        console.error('[breathe] 记录失败', e);
        wx.showToast({ title: '记录失败（可稍后在心情页补记）', icon: 'none' });
      }
    }
  },

  reset() {
    this._stop = true;
    this._running = false;
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
    this.setData({
      phase: 'ready', round: 0, ball: 150, trans: 0.5,
      text: '点击「开始」跟着节奏呼吸', calm: false
    });
  },

  // 记录「平静」前可选强度（1-5）
  setCalmInt(e) {
    const v = Number(e.currentTarget.dataset.v);
    if (v >= 1 && v <= 5) this.setData({ calmInt: v });
  }
});
