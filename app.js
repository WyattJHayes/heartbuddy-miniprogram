// app.js
App({
  globalData: {
    openid: '',
    isNewUser: false,     // 首次登录（第一次建用户记录）时为 true，用于欢迎语定制
    loginFallback: false, // 登录失败降级标志（降级后 DB 相关功能受限但应用不崩）
    // 云开发环境 ID：留空则使用当前默认环境；
    // 如需指定环境，可改为 'xxx-xxx'（在「云开发控制台 - 设置 - 环境 ID」查看）
    envId: ''
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以启用云能力');
      return;
    }
    try {
      wx.cloud.init({ env: this.globalData.envId || undefined, traceUser: true });
    } catch (e) {
      console.error('[cloud] init 失败：', e);
    }
    this.login();
  },

  /**
   * 静默登录：获取 openid，同时初始化 users 表记录。
   * 健壮性：
   *  - 并发去重：多次页面同时调用只会发起一次网络请求
   *  - 自动重试一次（800ms 后）
   *  - 最终降级：返回 '' 并把 loginFallback 置 true，应用其余功能照常可用
   */
  login() {
    // 并发去重：已有进行中的登录直接复用
    if (this._loginPromise) return this._loginPromise;

    const attempt = async () => {
      const res = await wx.cloud.callFunction({ name: 'login' });
      const r = (res && res.result) || {};
      return { openid: r.openid || '', isNewUser: !!r.isNewUser };
    };

    this._loginPromise = (async () => {
      // 第一次尝试
      try {
        const info = await attempt();
        if (info.openid) {
          this.globalData.openid = info.openid;
          this.globalData.isNewUser = info.isNewUser;
          this.globalData.loginFallback = false;
          return info.openid;
        }
      } catch (e) {
        console.warn('[login] 第一次失败：', e && e.message || e);
      }

      // 等 800ms 再试一次
      await new Promise((r) => setTimeout(r, 800));
      try {
        const info = await attempt();
        if (info.openid) {
          this.globalData.openid = info.openid;
          this.globalData.isNewUser = info.isNewUser;
          this.globalData.loginFallback = false;
          return info.openid;
        }
      } catch (e2) {
        console.warn('[login] 第二次失败', e2 && e2.message || e2);
      }

      // 最终降级：不阻断应用，DB 相关功能自然受限
      this.globalData.openid = '';
      this.globalData.isNewUser = false;
      this.globalData.loginFallback = true;
      console.warn('[login] 已降级：openid 为空，DB 记录类功能暂不可用');
      return '';
    })();

    // 无论成败，结束后清掉锁，允许后续再次调用
    this._loginPromise.then(() => { this._loginPromise = null; });
    this._loginPromise.catch(() => { this._loginPromise = null; });
    return this._loginPromise;
  }
});