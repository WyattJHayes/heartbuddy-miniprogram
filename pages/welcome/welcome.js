// pages/welcome/welcome.js —— 隐私同意 & AI 使用说明
const app = getApp();

Page({
  data: { loading: true, openid: '', showNotice: false, shared: false, welcomed: true },

  openNotice() { this.setData({ showNotice: true }); },
  closeNotice() { this.setData({ showNotice: false }); },
  noop() {},

  onLoad(options) {
    if (options && options.src === 'share') this.setData({ shared: true });
    this.setData({ welcomed: wx.getStorageSync('hb_welcomed') === true }); // 首次引导卡只出现一次
    if (!wx.getStorageSync('privacyAgreed')) {
      this.setData({ loading: false });
      return;
    }
    // 已同意过，直接进主页
    wx.switchTab({ url: '/pages/chat/chat' });
  },

  hideGuide() {
    wx.setStorageSync('hb_welcomed', true);
    this.setData({ welcomed: true });
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
  },

  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); },

  goTest() { wx.navigateTo({ url: '/pages/assessment/assessment' }); },

  goMood() { wx.switchTab({ url: '/pages/mood/mood' }); }
});