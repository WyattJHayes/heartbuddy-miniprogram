// pages/ops/ops.js —— 运营数据看板（演示）
const api = require('../../utils/api');
const { MOOD_SCORE } = require('../../utils/moodscore');

Page({
  data: {
    loading: true,
    admin: false,
    noRight: false,
    d: null,
    trendPoints: [],
    handling: '',   // 正在“一键处理”的危机记录 id
    weekRate: 0,    // 本周危机处理率（%）
    monthStat: null,  // 本月：{crisis, handled, rate}
    lastStat: null    // 上月：{crisis, handled, rate}
  },

  onShow() { this.load(); },

  async load() {
    this.setData({ loading: true });
    try {
      const res = await api.call('opsSummary');
      if (!res || !res.ok) {
        this.setData({ loading: false, noRight: !res || res.admin === false });
        return;
      }
      this.setData({ loading: false, admin: true, d: res.data || {} });
      const dd = res.data || {};
      const weekRate = dd.weekCrisis ? Math.round(((dd.weekHandled || 0) / dd.weekCrisis) * 100) : 0;
      // 月度对比：本月 vs 上月（预警数 + 已处理 + 处理率）
      const mk = (m) => {
        const crisis = m.crisis || 0;
        return { crisis, handled: m.handled || 0, rate: crisis ? Math.round(((m.handled || 0) / crisis) * 100) : 0 };
      };
      const thisMonth = mk({ crisis: dd.monthCrisis || 0, handled: dd.monthHandled || 0 });
      const lastMonth = mk({ crisis: dd.lastCrisis || 0, handled: dd.lastHandled || 0 });
      this.setData({ weekRate, monthStat: thisMonth, lastStat: lastMonth });
      this.loadTrend();
    } catch (e) {
      this.setData({ loading: false, noRight: true });
    }
  },

  // 近 14 日情绪均值（复用 utils/moodscore 与 emotion-chart 组件）
  async loadTrend() {
    try {
      const db = wx.cloud.database();
      const r = await db.collection('moods').orderBy('createdAt', 'desc').limit(300).get();
      const DAY = 86400000, n = 14;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sum = {}, cnt = {};
      for (let i = n - 1; i >= 0; i--) {
        const k = new Date(today.getTime() - i * DAY).toDateString();
        sum[k] = 0; cnt[k] = 0;
      }
      for (const m of r.data || []) {
        const k = new Date(m.createdAt).toDateString();
        if (!(k in sum)) continue;
        const s = MOOD_SCORE[m.mood];
        if (s != null) { sum[k] += s; cnt[k] += 1; }
      }
      const pad = (x) => (x < 10 ? '0' + x : x);
      const trend = [];
      for (let i = n - 1; i >= 0; i--) {
        const ts = new Date(today.getTime() - i * DAY);
        const k = ts.toDateString();
        const value = cnt[k] ? Math.round((sum[k] / cnt[k]) * 10) / 10 : null;
        trend.push({
          label: (i % 2 === 1) ? `${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}` : '',
          value
        });
      }
      this.setData({ trendPoints: trend });
    } catch (e) {
      console.warn('[ops] 趋势加载失败（不影响看板）', e);
    }
  },

  refresh() { this.load(); },

  // 高危用户 → 安排 24h 回访（写入 followUps，用户下次开口时 AI 自然问候一次）
  async scheduleFollow(e) {
    const openid = e.currentTarget.dataset.full;
    if (!openid) return;
    try {
      const db = wx.cloud.database();
      await db.collection('followUps').add({
        data: {
          openid,
          note: '高危用户关怀回访',
          status: 'open',
          dueAt: Date.now() + 24 * 3600 * 1000,
          createdAt: Date.now()
        }
      });
      wx.showToast({ title: '已安排 24h 后回访', icon: 'success' });
    } catch (err) {
      console.error('[ops] 安排回访失败', err);
      wx.showToast({ title: '安排失败，请重试', icon: 'none' });
    }
  },

  // 查看反馈全文（点击弹层，运营同理心）
  openFeed(e) {
    wx.showModal({
      title: '用户反馈全文',
      content: e.currentTarget.dataset.full || '（空）',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 一键转「督办单」：给高危用户生成带时限+备注的回访督办（12/24/48h 可选）
  taskit(e) {
    const openid = e.currentTarget.dataset.full;
    if (!openid) return;
    wx.showActionSheet({
      itemList: ['12 小时内回访督办', '24 小时内回访督办', '48 小时内回访督办'],
      success: (r) => {
        const hours = [12, 24, 48][r.tapIndex] || 24;
        wx.showModal({
          title: '转督办单',
          content: hours + ' 小时内的回访督办。给跟进人留句备注（可选）：',
          editable: true,
          placeholderText: '如：需电话确认是否安全',
          confirmText: '生成督办',
          success: async (m) => {
            if (!m.confirm) return;
            try {
              await wx.cloud.database().collection('followUps').add({
                data: {
                  openid,
                  note: (m.content || '').trim() || '危机跟进督办',
                  status: 'open',
                  dueAt: Date.now() + hours * 3600 * 1000,
                  createdAt: Date.now()
                }
              });
              wx.showToast({ title: '已生成 ' + hours + 'h 督办单', icon: 'success' });
            } catch (err) {
              console.error('[ops] 生成督办失败', err);
              wx.showToast({ title: '生成失败，请重试', icon: 'none' });
            }
          }
        });
      }
    });
  },

  // 批量：把所有未回应反馈一次标记为「已回应」
  handleAllFeed() {
    const feeds = (this.data.d && this.data.d.recentFeeds) || [];
    const left = feeds.filter((f) => f.status !== 'replied');
    if (!left.length) { wx.showToast({ title: '都已回应啦', icon: 'none' }); return; }
    wx.showModal({
      title: '全部标为已回应？',
      content: '会把 ' + left.length + ' 条未回应反馈一次性标记为已回应。',
      confirmText: '全部已回应',
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: '处理中…' });
        try {
          const res = await api.call('opsHandleFeedback', { all: true });
          wx.hideLoading();
          if (res && res.ok) {
            const feeds = (this.data.d.recentFeeds || []).map((f) =>
              f.status === 'replied' ? f : Object.assign({}, f, { status: 'replied' })
            );
            this.setData({ 'd.recentFeeds': feeds });
            wx.showToast({ title: '已全部标记 ✓', icon: 'success' });
          } else {
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  // 一键把反馈标记为「已回应」（写回 feedbacks，运营闭环）
  handleFeed(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '标记为已回应？',
      content: '表示运营已看到并跟进这条用户反馈。',
      confirmText: '已回应',
      success: async (r) => {
        if (!r.confirm) return;
        this.setData({ handlingFeed: id });
        try {
          const res = await api.call('opsHandleFeedback', { id });
          if (res && res.ok) {
            const feeds = (this.data.d.recentFeeds || []).map((f) =>
              f.id === id ? Object.assign({}, f, { status: 'replied' }) : f
            );
            this.setData({ 'd.recentFeeds': feeds, handlingFeed: '' });
            wx.showToast({ title: '已回应 ✓', icon: 'success' });
          } else {
            this.setData({ handlingFeed: '' });
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        } catch (err) {
          this.setData({ handlingFeed: '' });
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  // 一键把危机标记为已处理（写回 crisisAlerts，形成现场可点的闭环）
  handleCrisis(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '标记为已处理？',
      content: '该条危机记录将更新状态并写入处理时间，可随时在 re:center 复位。',
      confirmText: '标记已处理',
      success: async (r) => {
        if (!r.confirm) return;
        this.setData({ handling: id });
        try {
          const res = await api.call('opsHandleCrisis', { id });
          if (res && res.ok) {
            wx.showToast({ title: '已处理 ✓', icon: 'success' });
            this.load();
          } else {
            wx.showToast({ title: (res && res.error) || '处理失败', icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '调用失败，请重试', icon: 'none' });
        } finally {
          this.setData({ handling: '' });
        }
      }
    });
  },

  // 复制「高危用户脱敏清单」：用于拉群/交接，不含完整 openid
  copyHighList() {
    const list = (this.data.d && this.data.d.highUserList) || [];
    if (!list.length) {
      wx.showToast({ title: '暂无高危用户', icon: 'none' });
      return;
    }
    const lines = ['【心语伴 · 高危待跟进清单（近 7 天）】'];
    list.forEach((u, i) => {
      lines.push(`${i + 1}. 用户${u.short} · 高危 ${u.count} 次${u.lastAt ? ' · 最近 ' + u.lastAt : ''}`);
    });
    lines.push('（列表为脱敏 ID，仅供运营判断，请勿外传完整身份信息）');
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '已复制高危清单', icon: 'success' })
    });
  },

  // 复制危机统计 CSV（答辩/归档友好）
  copyCrisisCsv() {
    const d = this.data.d || {};
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const rows = [];
    rows.push(['等级', '关键词', '状态', '时间']);
    (d.recentCrisis || []).forEach((c) => {
      rows.push([c.level, c.keywords || '', c.status === 'handled' ? '已处理' : '待处理', c.time]);
    });
    rows.push(['', '', '', '']);
    rows.push(['指标', '数值']);
    [['累计用户', d.totalUsers], ['倾诉次数', d.totalChats], ['7日活跃', d.activeUsers7d],
      ['本周危机', d.weekCrisis], ['本周已处理', d.weekHandled], ['本周处理率%', this.data.weekRate],
      ['本月危机', d.monthCrisis], ['本月已处理', d.monthHandled],
      ['上月危机', d.lastCrisis], ['上月已处理', d.lastHandled],
      ['累计危机', d.totalCrisis], ['累计已处理', d.handledCrisis], ['未处理高危', d.openHigh]].forEach((r) => rows.push(r));
    const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
    wx.setClipboardData({
      data: csv,
      success: () => wx.showToast({ title: '已复制危机统计 CSV', icon: 'success' })
    });
  },
  copyTrend() {
    const pts = this.data.trendPoints || [];
    if (!pts.some((p) => p.value != null)) {
      wx.showToast({ title: '暂无趋势数据可导出', icon: 'none' });
      return;
    }
    const json = JSON.stringify(pts, null, 2);
    wx.setClipboardData({
      data: json,
      success: () => wx.showToast({ title: '已复制 14 日均值 JSON', icon: 'success' })
    });
  }
});