// pages/profile/profile.js —— 我的
const app = getApp();

Page({
  data: {
    openid: '',
    shortId: '',
    chatTotal: 0,
    assessTotal: 0,
    crisisTotal: 0,
    feedback: '',
    submitting: false
  },

  onShow() {
    this.loadStats();
  },

  async loadStats() {
    let openid = app.globalData.openid;
    if (!openid) openid = await app.login();
    this.setData({ openid: openid || '', shortId: openid ? openid.slice(-6) : '' });
    if (!openid) return;

    try {
      const db = wx.cloud.database();
      const [moods, assessments, crisis] = await Promise.all([
        db.collection('moods').where({ openid }).count(),
        db.collection('assessments').where({ openid }).count().catch(() => ({ total: 0 })),
        db.collection('crisisAlerts').where({ openid }).count().catch(() => ({ total: 0 }))
      ]);
      this.setData({
        chatTotal: moods.total || 0,
        assessTotal: assessments.total || 0,
        crisisTotal: crisis.total || 0
      });
    } catch (e) {
      console.error('[profile] 统计失败', e);
    }
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

  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); }
});