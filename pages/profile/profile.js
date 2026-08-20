// pages/profile/profile.js —— 我的
const app = getApp();
const api = require('../../utils/api');

Page({
  data: {
    openid: '',
    shortId: '',
    chatTotal: 0,
    assessTotal: 0,
    crisisTotal: 0,
    feedback: '',
    submitting: false,
    badges: [],
    gotCount: 0,
    badgeTotal: 0,
    // 数据足迹
    firstDate: '',     // 最早一条记录
    streakDays: 0,     // 当前连续打卡天数（本地估算）
    mood7: [],         // 近 7 天是否记录（true/false × 7，最左是最老）
    footprintSum: 0,
    // 我的珍藏（聊天长按珍藏，本地保存）
    favs: [],
    showFavs: false,
    favCount: 0
  },

  onShow() {
    this.loadStats();
    this.refreshBadges();
    this.refreshFavs();
  },

  // ---- 我的珍藏（聊天页长按消息珍藏，本地）----
  refreshFavs() {
    const favs = wx.getStorageSync('hb_favs') || [];
    this.setData({ favCount: favs.length });
  },

  openFavs() {
    const favs = wx.getStorageSync('hb_favs') || [];
    this.setData({ showFavs: true, favs });
  },

  closeFavs() { this.setData({ showFavs: false }); },

  noop() {},

  copyFav(e) {
    const t = e.currentTarget.dataset.text;
    if (!t) return;
    wx.setClipboardData({ data: t, success: () => wx.showToast({ title: '已复制', icon: 'none' }) });
  },

  // 长按单条珍藏 → 确认后删除
  delFav(e) {
    const i = Number(e.currentTarget.dataset.i);
    const favs = this.data.favs || [];
    if (!(i >= 0) || !favs[i]) return;
    const snippet = favs[i].text.length > 12 ? favs[i].text.slice(0, 12) + '…' : favs[i].text;
    wx.showModal({
      title: '删除这条珍藏？',
      content: `「${snippet}」`,
      confirmText: '删除',
      cancelText: '留下',
      success: (r) => {
        if (!r.confirm) return;
        const next = favs.slice();
        next.splice(i, 1);
        wx.setStorageSync('hb_favs', next);
        this.setData({ favs: next, favCount: next.length });
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },

  clearFavs() {
    wx.showModal({
      title: '清空我的珍藏？',
      content: '本地珍藏将全部删除，不可恢复。',
      confirmText: '清空',
      success: (r) => {
        if (!r.confirm) return;
        wx.removeStorageSync('hb_favs');
        this.setData({ showFavs: false, favs: [], favCount: 0 });
        wx.showToast({ title: '已清空', icon: 'none' });
      }
    });
  },

  // 成就徽章（本地记录解锁情况）
  refreshBadges() {
    const defs = [
      { key: 'ach_firstRecord', emoji: '🌱', title: '走出第一步', desc: '记录第一条心情' },
      { key: 'ach_streak3', emoji: '🔥', title: '坚持 3 天', desc: '连续打卡 3 天' },
      { key: 'ach_streak7', emoji: '🌿', title: '坚持 7 天', desc: '连续打卡 7 天' },
      { key: 'ach_breathe',     emoji: '🍃', title: '一呼一吸', desc: '完成一次呼吸练习' },
      { key: 'ach_breathe5',    emoji: '🧘', title: '呼吸行者', desc: '呼吸练习累计 5 次' },
      { key: 'ach_assess',      emoji: '📋', title: '认识自己', desc: '完成一次自评' },
      { key: 'ach_letter',      emoji: '💌', title: '写给未来', desc: '寄出时光信' },
      { key: 'ach_care',        emoji: '💛', title: '也请心语来看我', desc: '安排一次 24h 回访' },
      { key: 'ach_fav',         emoji: '📌', title: '念念不忘', desc: '珍藏一句话' },
      { key: 'ach_scan',        emoji: '🧭', title: '安放自己', desc: '完成 1 次身体扫描' },
      { key: 'ach_scan3',       emoji: '🌌', title: '内在旅行者', desc: '身体扫描累计 3 次' },
      { key: 'ach_small3',      emoji: '💫', title: '微小而确定', desc: '一天之内做完 3 件小事' },
      { key: 'ach_share',       emoji: '🤝', title: '陪伴他人', desc: '把心语伴分享出去' }
    ];
    const scanCount = wx.getStorageSync('hb_scanCount') || 0;
    const badges = defs.map((b) => {
      let got = !!wx.getStorageSync(b.key);
      if (b.key === 'ach_scan' && got) got = true;
      if (b.key === 'ach_scan3' && scanCount >= 3) got = true;
      return { ...b, got };
    });
    const gotCount = badges.filter((b) => b.got).length;
    this.setData({ badges, gotCount, badgeTotal: badges.length });
  },

  async loadStats() {
    let openid = app.globalData.openid;
    if (!openid) openid = await app.login();
    this.setData({ openid: openid || '', shortId: openid ? openid.slice(-6) : '' });
    if (!openid) return;

    try {
      const db = wx.cloud.database();
      const [moods, assessments, crisis, firstRec] = await Promise.all([
        db.collection('moods').where({ openid }).count(),
        db.collection('assessments').where({ openid }).count().catch(() => ({ total: 0 })),
        db.collection('crisisAlerts').where({ openid }).count().catch(() => ({ total: 0 })),
        db.collection('moods').where({ openid }).orderBy('createdAt', 'asc').limit(1).get().catch(() => ({ data: [] }))
      ]);
      // 连续打卡：取最近 30 条，从今天往回数
      const recent = await db.collection('moods').where({ openid }).orderBy('createdAt', 'desc').limit(30).get().catch(() => ({ data: [] }));
      const daySet = new Set((recent.data || []).map((m) => new Date(m.createdAt).toDateString()));
      const DAY = 24 * 3600 * 1000;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (!daySet.has(today.toDateString())) {
        const y = new Date(today.getTime() - DAY);
        if (!daySet.has(y.toDateString())) { /* streak 0 */ }
      }
      let streakDays = 0;
      const cursor = daySet.has(today.toDateString()) ? today : new Date(today.getTime() - DAY);
      while (daySet.has(cursor.toDateString())) {
        streakDays += 1;
        cursor.setTime(cursor.getTime() - DAY);
        if (streakDays > 365) break;
      }
      // 近 7 天记录足迹（最老 → 最新）
      const mood7 = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * DAY);
        mood7.push(daySet.has(d.toDateString()) ? 1 : 0);
      }
      const first = firstRec.data && firstRec.data[0];
      this.setData({
        chatTotal: moods.total || 0,
        assessTotal: assessments.total || 0,
        crisisTotal: crisis.total || 0,
        firstDate: first ? this.fmtDate(first.createdAt) : '—',
        streakDays,
        mood7Days: mood7,
        footprintSum: (moods.total || 0) + (assessments.total || 0) + (crisis.total || 0)
      });
    } catch (e) {
      console.error('[profile] 统计失败', e);
    }
  },

  fmtDate(ts) {
    const d = new Date(ts);
    const p = (n) => (n < 10 ? '0' + n : n);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  // 一键导出本人数据（数据可携带权）：读自己全部集合 → 复制 JSON 文本
  async exportData() {
    let openid = app.globalData.openid;
    if (!openid) openid = await app.login();
    if (!openid) { wx.showToast({ title: '登录中，请稍后再试', icon: 'none' }); return; }
    const db = wx.cloud.database();
    const grab = (coll) =>
      db.collection(coll).where({ openid }).orderBy('createdAt', 'desc').limit(30).get()
        .then((r) => (r && r.data) || [])
        .catch(() => []);
    try {
      const [moods, assessments, crisis, feedbacks] = await Promise.all([
        grab('moods'), grab('assessments'), grab('crisisAlerts'), grab('feedbacks')
      ]);
      const payload = {
        app: 'heartbuddy-miniprogram',
        exportedAt: new Date().toISOString(),
        note: '以下数据仅为你在本小程序中的记录（对话内容不入库），openid 已脱敏。',
        counts: { moods: moods.length, assessments: assessments.length, crisisAlerts: crisis.length, feedbacks: feedbacks.length },
        data: {
          moods: this.mask(moods),
          assessments: assessments.length,
          crisisAlerts: crisis.length,
          feedbacks: feedbacks.length
        }
      };
      const text = JSON.stringify(payload, null, 2);
      const total = payload.counts.moods + payload.counts.assessments + payload.counts.crisisAlerts + payload.counts.feedbacks;
      wx.setClipboardData({
        data: text,
        success: () => wx.showModal({
          title: '已复制导出数据',
          content: `共 ${total} 条记录已按 JSON 复制到剪贴板（仅本人数据，已脱敏）。粘贴到备忘录即可保存。`,
          showCancel: false,
          confirmText: '知道了'
        })
      });
    } catch (e) {
      console.error('[profile] 导出失败', e);
      wx.showToast({ title: '导出失败，请重试', icon: 'none' });
    }
  },

  // 简单脱敏：openid 只保留前 6 位
  mask(list) {
    return list.map((it) => ({ ...it, openid: (it.openid || '').slice(0, 6) + '…' }));
  },

  onFeedback(e) {
    this.setData({ feedback: e.detail.value });
  },

  async submitFeedback() {
    const content = this.data.feedback.trim();
    if (!content || this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const db = wx.cloud.database();
      await db.collection('feedbacks').add({
        data: { openid: this.data.openid, comment: content, rating: 5, createdAt: Date.now() }
      });
      this.setData({ feedback: '', submitting: false });
      wx.showToast({ title: '谢谢你，已收到', icon: 'success' });
    } catch (e) {
      this.setData({ submitting: false });
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  },

  viewPrivacy() {
    wx.showModal({
      title: '隐私说明',
      content: '心语伴不会收集你的真实姓名、位置与通讯录。对话仅用于情绪陪伴服务。AI 生成内容仅供参考，不构成医疗建议。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  goReport() { wx.navigateTo({ url: '/pages/report/report' }); },

  goOps() { wx.navigateTo({ url: '/pages/ops/ops' }); },

  // 隐私合规：一键清空本人全部记录（双确认，防误触）
  clearData() {
    wx.showModal({
      title: '清空我的记录？',
      content: '将删除本机已同步的全部情绪记录、自评与危机提醒，且不可恢复。是否继续？',
      confirmText: '仍要清空',
      confirmColor: '#e05c4e',
      success: (r) => {
        if (!r.confirm) return;
        wx.showModal({
          title: '最后确认',
          content: '删除后无法找回。确定清空？',
          confirmText: '确认清空',
          confirmColor: '#e05c4e',
          success: async (r2) => {
            if (!r2.confirm) return;
            wx.showLoading({ title: '清理中…' });
            try {
              const res = await api.call('clearMyData');
              wx.hideLoading();
              if (res && res.ok) {
                this.loadStats();
                wx.showToast({ title: '已清空', icon: 'success' });
              } else {
                wx.showToast({ title: (res && res.error) || '清理失败', icon: 'none' });
              }
            } catch (e) {
              wx.hideLoading();
              wx.showToast({ title: '清理失败，请重试', icon: 'none' });
            }
          }
        });
      }
    });
  },

  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); },

  // 隐私合规：重新查看《用户须知与免责声明》（清除本机已同意标记，回到欢迎页）
  resetPrivacy() {
    wx.showModal({
      title: '重新查看隐私指引？',
      content: '将退出当前会话并回到欢迎页，重新展示《用户须知与免责声明》，需要再次点击同意才能继续。',
      confirmText: '重新查看',
      success: (r) => {
        if (!r.confirm) return;
        wx.removeStorageSync('privacyAgreed');
        wx.reLaunch({ url: '/pages/welcome/welcome' });
      }
    });
  }
});