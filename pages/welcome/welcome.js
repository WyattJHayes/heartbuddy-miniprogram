// pages/welcome/welcome.js —— 隐私同意 & AI 使用说明
const app = getApp();

Page({
  data: { loading: true, openid: '' },

  onLoad() {
    if (!wx.getStorageSync('privacyAgreed')) {
      this.setData({ loading: false });
      return;
    }
    // 已同意过，直接进主页
    wx.switchTab({ url: '/pages/chat/chat' });
  },

  ensureLogin: async function () {
    let openid = app.globalData.openid;
    if (!openid) openid = await app.login();
    return openid;
  },

  async agree() {
    wx.showLoading({ title: '加载中', mask: true });
    await this.ensureLogin();
    wx.hideLoading();
    wx.setStorageSync('privacyAgreed', true);
    wx.switchTab({ url: '/pages/chat/chat' });
  }
});