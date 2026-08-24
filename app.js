// app.js
// 昨天的「年月日」键（与深夜陪伴同格式，用于清晨回访判断昨晚是否熬夜）
function yesterdayKey(todayKey) {
  const d = new Date(Date.now() - 86400000);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

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
    this.checkNightWindDown();
    this.checkMorningCare();
  },

  // 陪伴纪念日：每次打开轻计一次，到了整数次给一句「你来了这么多次」
  bumpOpenCount() {
    try {
      const n = Number(wx.getStorageSync('hb_openCount') || 0) + 1;
      wx.setStorageSync('hb_openCount', n);
      const MILESTONES = [10, 25, 50, 100, 200, 365];
      if (MILESTONES.includes(n) && !wx.getStorageSync('hb_mile_' + n)) {
        wx.setStorageSync('hb_mile_' + n, true);
        wx.setStorageSync('hb_milestone', n);
        const m = {
          10: '打开第 10 次——你也开始习惯「有事就来说说」了 ☁️',
          25: '第 25 次打开。这段陪伴，你已经坚持有一阵子了 🌱',
          50: '第 50 次。很认真地照顾自己的人，值得被自己看见 🌟',
          100: '第 100 次打开。这不是巧合，是你对自己长期的温柔 💛',
          200: '第 200 次。你大概已经知道，这里一直都在 ☀️',
          365: '整整一年了。谢谢你，常回来。🌻'
        };
        wx.showToast({ title: m[n] || '', icon: 'none', duration: 3000 });
      }
    } catch (e) { /* 忽略 */ }
  },

  onShow() {
    this.checkDailyRemind();
    // 记录最近离开的页面（欢迎页用于「继续上次」；welcome 自己不算）
    try {
      const pages = getCurrentPages();
      const cur = pages.length ? pages[pages.length - 1] : null;
      const route = cur ? cur.route : '';
      if (route && route.indexOf('pages/welcome/') !== 0) {
        wx.setStorageSync('hbLastRoute', route);
      }
    } catch (e) { /* 忽略 */ }
  },

  /**
   * 清晨回访（本地）：5:00–9:00 首次打开时。
   * 若昨晚深夜收尾陪伴出现过（说明用户熬到了很晚），轻轻问一句「昨晚睡得好吗」，
   * 认可「熬夜也有好好照顾自己」，并提供今日的第一杯咖啡/呼吸。每天一次。
   */
  checkMorningCare() {
    try {
      const now = new Date();
      const h = now.getHours();
      if (h < 5 || h >= 9) return;
      const todayKey = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
      if (wx.getStorageSync('hb_morningCare') === todayKey) return;
      // 昨晚（昨天/今晨）夜里 22 点后出现过深夜陪伴
      const nightKey = yesterdayKey(todayKey);
      const hadNight = wx.getStorageSync('hb_nightWind') === nightKey;
      // 昨天熬过夜：深夜工具出现过
      if (!hadNight) return;
      wx.setStorageSync('hb_morningCare', todayKey);
      wx.showModal({
        title: '🌅 早，新的一天来了',
        content: '昨晚那么晚还在照顾自己，辛苦了。今早不用急着做什么——先喝口水，或者用 30 秒呼吸醒醒神，再开始这一天的第一件事。',
        confirmText: '去呼吸一下',
        cancelText: '喝水去',
        success: (r) => {
          if (r.confirm) wx.navigateTo({ url: '/pages/breathe/breathe' });
        }
      });
    } catch (e) {
      console.warn('[morningCare] 检查失败', e);
    }
  },
  checkNightWindDown() {
    try {
      const now = new Date();
      const h = now.getHours();
      const isNight = h >= 22 || h < 5;
      if (!isNight) return;
      const todayKey = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
      if (wx.getStorageSync('hb_nightWind') === todayKey) return;
      // 今天有没有做过「照顾自己的事」（任一即可，避免空转打扰）
      const scanDone = (wx.getStorageSync('hb_scanDoneLog') || []).some((t) => new Date(t).toDateString() === now.toDateString());
      const moodToday = wx.getStorageSync('hb_lastMoodDate') === todayKey;
      const bd = wx.getStorageSync('hb_breatheDay');
      const breatheDay = bd && bd.date === now.toDateString();
      const smallN = (wx.getStorageSync('hb_smallWeek') || 0);
      const didSomething = scanDone || moodToday || breatheDay || smallN > 0;
      if (!didSomething) return;
      wx.setStorageSync('hb_nightWind', todayKey);
      wx.showModal({
        title: '🌙 夜深了，你真的一天有好好照顾自己',
        content: '今天的呼吸/记录，我都记得。睡前花 30 秒把今天轻轻合上：和心语道个晚安，或做一轮发呆呼吸。',
        confirmText: '道个晚安去睡',
        cancelText: '先去呼吸 🌬',
        success: (r) => {
          if (r.confirm) wx.switchTab({ url: '/pages/chat/chat' });
          else wx.navigateTo({ url: '/pages/breathe/breathe' });
        }
      });
    } catch (e) {
      console.warn('[nightWind] 检查失败', e);
    }
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