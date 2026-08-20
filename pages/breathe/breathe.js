// pages/breathe/breathe.js —— 呼吸练习引导（纯本地、无网络）
// 每个圆 = 一轮：吸气(约 3.8s)→屏住(约 3.2s)→呼气(约 5.6s)，共 4 轮。
const app = getApp();

// [阶段名, 时长ms, 目标尺寸(rpx), transition 秒]
const ROUNDS = [
  ['in', 3800, 460, 3.9],
  ['hold', 3200, 460, 0.6],
  ['out', 5600, 150, 5.6]
];
const PH_TEXT = {
  in: '吸气……把空气慢慢填满',
  hold: '屏住呼吸',
  out: '呼气……放松肩膀',
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
    calm: false
  },

  onLoad() {
    this._timers = [];
    this._stop = false;
    this._running = false;
  },

  onUnload() {
    this._stop = true;
    (this._timers || []).forEach((t) => clearTimeout(t));
  },

  start() {
    if (this._running) return;
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
    this._running = true;
    this._stop = false;
    this.setData({ round: 1 });
    this.runRound(1, 0);
  },

  runRound(r, step) {
    if (this._stop) return;
    if (step >= ROUNDS.length) {
      if (r < this.data.total) {
        this.runRound(r + 1, 0);
      } else {
        this._running = false;
        this.setData({ phase: 'done', text: PH_TEXT.done });
      }
      return;
    }
    const [phase, ms, ball, trans] = ROUNDS[step];
    this.setData({ round: r, phase, ball, trans, text: PH_TEXT[phase] });
    const timer = setTimeout(() => this.runRound(r, step + 1), ms);
    this._timers.push(timer);
  },

  // 结束后把此刻情绪记成「平静」（与心情页/曲线无缝联动）
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
            intensity: 3,
            trigger: '呼吸练习',
            createdAt: Date.now()
          }
        });
        if (!wx.getStorageSync('ach_firstRecord')) wx.setStorageSync('ach_firstRecord', true);
        // 呼吸练习徽章：完成 1 次 / 累计 5 次
        const bc = (wx.getStorageSync('breatheCount') || 0) + 1;
        wx.setStorageSync('breatheCount', bc);
        if (!wx.getStorageSync('ach_breathe')) wx.setStorageSync('ach_breathe', true);
        if (bc >= 5 && !wx.getStorageSync('ach_breathe5')) wx.setStorageSync('ach_breathe5', true);
        wx.vibrateShort && wx.vibrateShort({ type: 'light' });
        wx.showToast({ title: '已记下此刻的平静', icon: 'success' });
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
  }
});