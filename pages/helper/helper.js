// pages/helper/helper.js —— 求助中心
const { hotlines } = require('../../config/index');

Page({
  data: {
    hotlines
  },

  call(e) {
    const number = e.currentTarget.dataset.number;
    if (!number) return;
    wx.makePhoneCall({ phoneNumber: number, fail: () => {} });
  },

  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); }
});