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
    this.checkDailyRemind();
  },

  onShow() {
    this.checkDailyRemind();
  },

  /**
   * 每日轻提醒（本地）：用户在我的页设置了提醒时间后，
   * 每次打开小程序时检查：是否已到点、今天是否提醒过 —— 是则温柔弹一次，直达呼吸/记录。
   */
  checkDailyRemind() {
    try {
      const cfg = wx.getStorageSync('hb_dailyRemind');
      if (!cfg || !cfg.on || !cfg.time) return;
      const now = new Date();
      const hm = String(cfg.time).split(':');
      const h = Number(hm[0] || 0), m = Number(hm[1] || 0);
      // 到点判定：当前时间 >= 设定时间
      if (now.getHours() < h || (now.getHours() === h && now.getMinutes() < m)) return;
      const todayKey = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
      if (wx.getStorageSync('hb_dailyRemindLast') === todayKey) return;
      wx.setStorageSync('hb_dailyRemindLast', todayKey);
      // 温柔提醒：不打扰在对话中的用户；深色氛围用 🌙
      const night = now.getHours() >= 21 || now.getHours() < 6;
      wx.showModal({
        title: night ? '🌙 今天辛苦了' : '🌤 今天的照顾，别忘了',
        content: '到约定的时间了——花一分钟照顾一下自己：深呼吸，或者把此刻的心情记下来。',
        confirmText: '去呼吸放松',
        cancelText: '稍后再说',
        success: (r) => {
          if (r.confirm) {
            const page = getCurrentPages();
            const url = night ? '/pages/scan/scan' : '/pages/breathe/breathe';
            wx.navigateTo({ url });
          }
        }
      });
    } catch (e) {
      console.warn('[dailyRemind] 检查失败', e);
    }
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