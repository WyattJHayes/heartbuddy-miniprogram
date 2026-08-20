// pages/ops/ops.js —— 运营数据看板（演示）
const api = require('../../utils/api');

Page({
  data: {
    loading: true,
    admin: false,
    noRight: false,
    d: null
  },

  onShow() { this.load(); },

  async load() {
    this.setData({ loading: true });
    try {
      const res = await api.call('opsSummary');
      if (!res || !res.ok) {
        this.setData({ loading: false, noRight: res && res.admin === false, noRight: !res || res.admin === false });
        return;
      }
      this.setData({ loading: false, admin: true, d: res.data || {} });
    } catch (e) {
      this.setData({ loading: false, noRight: true });
    }
  },

  refresh() { this.load(); }
});