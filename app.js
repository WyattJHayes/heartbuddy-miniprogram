// app.js
App({
  globalData: {
    openid: '',
    // 云开发环境 ID：留空则使用当前默认环境；
    // 如需指定环境，可改为 'xxx-xxx'（在「云开发控制台 - 设置 - 环境 ID」查看）
    envId: ''
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: this.globalData.envId || undefined,
        traceUser: true
      });
      this.login();
    }
  },

  /** 静默登录：拿 openid，顺便初始化 users 表记录 */
  async login() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login' });
      this.globalData.openid = (res && res.result && res.result.openid) || '';
      return this.globalData.openid;
    } catch (err) {
      console.error('[login] 失败：', err);
      return '';
    }
  }
});