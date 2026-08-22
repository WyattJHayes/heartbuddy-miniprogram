// pages/welcome/welcome.js —— 隐私同意 & AI 使用说明
const app = getApp();

Page({
  data: {
    loading: true, openid: '', showNotice: false, shared: false, welcomed: true, showLog: false,
    changelog: [
      { v: '1.6', t: '心理小课 7 节 + 温故一题 + 结业卡；小结日记本；情绪词库卡' },
      { v: '1.5', t: '安全包支持存电话一键拨打；「帮助朋友」危机卡；话术 7 种情境' },
      { v: '1.4', t: '我的常用语；周一上周陪伴小结；连续空白温柔提醒' },
      { v: '1.3', t: '自定义呼吸节奏 + 近 4 周热力图；按场景三件小事灵感' },
      { v: '1.2', t: '情绪急救包；今日小结；今日心情卡分享图' },
      { v: '1.1', t: '想法小剧场、信匣、四段危机回访、5-4-3-2-1 接地术' }
    ]
  },

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

  toggleLog() { this.setData({ showLog: !this.data.showLog }); },

  goFromGuide(e) {
    const u = e.currentTarget.dataset.u;
    wx.setStorageSync('hb_welcomed', true);
    if (u && wx.getStorageSync('privacyAgreed')) wx.switchTab({ url: u });
    else this.setData({ welcomed: true });
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