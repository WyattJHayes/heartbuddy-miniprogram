// pages/scan/scan.js —— 5 分钟身体扫描（站内正念，纯本地计时）
const app = getApp();

// 10 段「部位 → 引导语 → 时长(秒)」，合计约 5 分钟
const STAGES = [
  { t: '找个舒服的姿势', d: '坐着或躺着，轻轻闭上眼睛，把注意力先放到腿上。', sec: 30 },
  { t: '感受呼吸', d: '不用刻意调整，就像现在这样，让呼吸自然流动。', sec: 30 },
  { t: '脚底', d: '把注意力放到脚底，感受它和地面、鞋子的接触与温度。', sec: 30 },
  { t: '小腿与大腿', d: '感受小腿的重量、大腿的松弛感，不需要调整，只是「注意到」它在那儿。', sec: 30 },
  { t: '腹部与后背', d: '感受腹部随着呼吸起伏，后背被椅子或床稳稳地托住。', sec: 30 },
  { t: '胸口与肩膀', d: '让呼吸顺畅脉动，肩膀如果还拎着，就顺着呼气松一松。', sec: 30 },
  { t: '手臂', d: '感受双手自然地垂下来，手指轻轻张开，放在舒服的位置。', sec: 30 },
  { t: '头与脸', d: '留意眉心与下颌的紧张，让表情放松下来，下巴轻轻松开。', sec: 30 },
  { t: '整个身体', d: '把注意力放回整个身体——一个完整、正在呼吸、在这里的自己。', sec: 45 },
  { t: '回到当下', d: '慢慢活动手指脚趾，眨眨眼睛，再看一眼周围的安静。', sec: 45 }
];

Page({
  data: {
    stages: STAGES,
    phase: 'ready',   // ready | run | done
    idx: 0,
    left: 30,
    pct: 0,
    lastDone: '',
    calmInt: 3        // 完成后「此刻平静程度」（1-5，默认 3，随记录入库）
  },

  onLoad() {
    this._timer = null;
    this._busy = false;
    const ts = wx.getStorageSync('hb_scanDone');
    if (ts) this.setData({ lastDone: `上次完成：${this.fmtDate(ts)}` });
    this.setData({ scanCount: wx.getStorageSync('hb_scanCount') || 0 });
  },

  onUnload() { this.stop(); },

  fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  },

  begin() {
    this.setData({ phase: 'run', idx: 0, left: STAGES[0].sec, pct: 0 });
    this.startTimer();
  },

  startTimer() {
    this.stop();
    const self = this;
    this._timer = setInterval(() => {
      const { phase, idx, left } = self.data;
      if (phase !== 'run') return self.stop();
      if (left > 1) {
        self.setData({ left: left - 1, pct: (1 - left / STAGES[idx].sec) * 100 });
      } else if (idx + 1 < STAGES.length) {
        const n = idx + 1;
        self.setData({ idx: n, left: STAGES[n].sec, pct: 0 });
      } else {
        self.onFinish();
      }
    }, 1000);
  },

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  finish() { this.onFinish(); },

  async onFinish() {
    this.stop();
    this.setData({ phase: 'done' });
    const ts = Date.now();
    wx.setStorageSync('hb_scanDone', ts);
    this.setData({ lastDone: `上次完成：${this.fmtDate(ts)}` });
    // 记一次「平静」情绪，进入心情曲线
    try {
      let openid = app.globalData.openid;
      if (!openid) openid = await app.login();
      if (!openid) return;
      await wx.cloud.database().collection('moods').add({
        data: { openid, mood: 'peace', intensity: this.data.calmInt || 3, trigger: '身体扫描', note: '5分钟身体扫描完成', createdAt: Date.now() }
      });
      wx.setStorageSync('ach_body_scan', true);
      wx.setStorageSync('ach_scan', true);
      wx.setStorageSync('hb_scanCount', (wx.getStorageSync('hb_scanCount') || 0) + 1);
    } catch (e) {
      console.warn('[scan] 记录心情失败', e);
    }
  },

  exit() {
    if (this.data.phase === 'run') {
      wx.showModal({
        title: '要提前结束吗',
        content: '随时可以下次再来，你的感受最重要。',
        confirmText: '结束',
        cancelText: '继续扫描',
        success: (r) => { if (r.confirm) { this.stop(); wx.navigateBack(); } }
      });
    } else {
      wx.navigateBack();
    }
  },

  // 完成后可选平静程度（1-5，随自动记录入库）
  setCalmInt(e) {
    const v = Number(e.currentTarget.dataset.v);
    if (v >= 1 && v <= 5) this.setData({ calmInt: v });
  },

  again() {
    this.setData({ phase: 'ready', idx: 0, left: STAGES[0].sec, pct: 0 });
  }
});