// pages/ops/ops.js —— 运营数据看板（演示）
const api = require('../../utils/api');
const { MOOD_SCORE } = require('../../utils/moodscore');

Page({
  data: {
    loading: true,
    admin: false,
    noRight: false,
    d: null,
    trendPoints: []
  },

  onShow() { this.load(); },

  async load() {
    this.setData({ loading: true });
    try {
      const res = await api.call('opsSummary');
      if (!res || !res.ok) {
        this.setData({ loading: false, noRight: !res || res.admin === false });
        return;
      }
      this.setData({ loading: false, admin: true, d: res.data || {} });
      this.loadTrend();
    } catch (e) {
      this.setData({ loading: false, noRight: true });
    }
  },

  // 近 14 日情绪均值（复用 utils/moodscore 与 emotion-chart 组件）
  async loadTrend() {
    try {
      const db = wx.cloud.database();
      const r = await db.collection('moods').orderBy('createdAt', 'desc').limit(300).get();
      const DAY = 86400000, n = 14;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sum = {}, cnt = {};
      for (let i = n - 1; i >= 0; i--) {
        const k = new Date(today.getTime() - i * DAY).toDateString();
        sum[k] = 0; cnt[k] = 0;
      }
      for (const m of r.data || []) {
        const k = new Date(m.createdAt).toDateString();
        if (!(k in sum)) continue;
        const s = MOOD_SCORE[m.mood];
        if (s != null) { sum[k] += s; cnt[k] += 1; }
      }
      const pad = (x) => (x < 10 ? '0' + x : x);
      const trend = [];
      for (let i = n - 1; i >= 0; i--) {
        const ts = new Date(today.getTime() - i * DAY);
        const k = ts.toDateString();
        const value = cnt[k] ? Math.round((sum[k] / cnt[k]) * 10) / 10 : null;
        trend.push({
          label: (i % 2 === 1) ? `${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}` : '',
          value
        });
      }
      this.setData({ trendPoints: trend });
    } catch (e) {
      console.warn('[ops] 趋势加载失败（不影响看板）', e);
    }
  },

  refresh() { this.load(); },

  // 复制近 14 日均值（便于答辩/Excel 使用）
  copyTrend() {
    const pts = this.data.trendPoints || [];
    if (!pts.some((p) => p.value != null)) {
      wx.showToast({ title: '暂无趋势数据可导出', icon: 'none' });
      return;
    }
    const json = JSON.stringify(pts, null, 2);
    wx.setClipboardData({
      data: json,
      success: () => wx.showToast({ title: '已复制 14 日均值 JSON', icon: 'success' })
    });
  }
});