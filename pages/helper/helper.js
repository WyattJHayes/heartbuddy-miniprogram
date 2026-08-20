// pages/helper/helper.js —— 求助中心
const { hotlines } = require('../../config/index');

Page({
  data: {
    hotlines,
    safety: false, // 是否已设置 24 小时回访
    safetyHint: ''
  },

  onLoad() {
    const t = wx.getStorageSync('crisisCheck');
    if (t && t > Date.now()) this.setData({ safety: true });
  },

  call(e) {
    const number = e.currentTarget.dataset.number;
    if (!number) return;
    wx.makePhoneCall({ phoneNumber: number, fail: () => {} });
  },

  // 已安全回执：24 小时后在「陪伴」页轻声回访一次
  checkSafe() {
    wx.showModal({
      title: '安排 24 小时回访',
      content: '心语会在 24 个小时后，在「陪伴」页轻轻和你说一句“现在好吗”。可以吗？',
      confirmText: '好的',
      success: (r) => {
        if (!r.confirm) return;
        wx.setStorageSync('crisisCheck', Date.now() + 24 * 3600 * 1000);
        this.setData({ safety: true });
        wx.showToast({ title: '已安排回访 🌱', icon: 'success' });
      }
    });
  },

  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); }
});