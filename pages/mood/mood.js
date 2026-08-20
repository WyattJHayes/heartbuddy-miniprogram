// pages/mood/mood.js —— 情绪记录 & 可视化
const app = getApp();
const { MOOD_META, MOOD_SCORE } = require('../../utils/moodscore');

Page({
  data: {
    loaded: false,
    empty: true,
    statList: [],   // 各情绪占比 [{emoji,label,count,ratio}]
    recentList: [],  // 最近记录 [{time,mood,label}]
    moodLine: []     // 近 7 天 [{label,value}]，无记录 value:null
  },

  onShow() { this.fetchMoods(); },

  async fetchMoods() {
    let openid = app.globalData.openid;
    if (!openid) {
      openid = await app.login();
      if (!openid) return;
    }
    try {
      const db = wx.cloud.database();
      const res = await db
        .collection('moods')
        .where({ openid })
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const raw = res.data || [];
      const list = raw.map((m) => {
        const meta = MOOD_META[m.mood] || MOOD_META.peace;
        const d = new Date(m.createdAt);
        const pad = (n) => (n < 10 ? '0' + n : n);
        return {
          time: `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
          label: meta.label,
          emoji: meta.emoji
        };
      });

      this.renderStats(list);
      const moodLine = this.buildLine(raw);
      this.setData({ recentList: list.slice(0, 7), moodLine, empty: list.length === 0, loaded: true });
    } catch (e) {
      console.error('[mood] 读取失败', e);
      this.setData({ loaded: true });
    }
  },

  // 近 7 天：每天取最后一次记录的分值（无记录为 null）
  buildLine(raw) {
    const DAY = 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const ts = new Date(today.getTime() - i * DAY);
      const pad = (n) => (n < 10 ? '0' + n : n);
      days.push({ label: `${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}`, value: null });
    }
    // raw 为 createdAt 降序 → 首次出现的即当天最新记录
    const seen = {};
    for (const m of raw) {
      const key = new Date(m.createdAt).toDateString();
      if (!(key in seen)) seen[key] = m;
    }
    const dayKeys = {};
    days.forEach((d, i) => {
      dayKeys[this.dateKey(new Date(today.getTime() - (6 - i) * DAY))] = d;
    });
    for (const key in seen) {
      if (dayKeys[key]) {
        const v = seen[key];
        dayKeys[key].value = MOOD_SCORE[v.mood] != null ? MOOD_SCORE[v.mood] : 2;
      }
    }
    return days;
  },

  dateKey(d) { return d.toDateString(); },

  renderStats(list) {
    const counts = {};
    list.forEach((m) => {
      const label = m.label;
      counts[label] = (counts[label] || 0) + 1;
    });
    const total = list.length || 1;
    const statList = Object.keys(counts)
      .map((label) => {
        const meta = Object.values(MOOD_META).find((x) => x.label === label) || MOOD_META.peace;
        return { emoji: meta.emoji, label, count: counts[label], ratio: Math.round((counts[label] / total) * 100) };
      })
      .sort((a, b) => b.count - a.count);
    this.setData({ statList });
  },

  goReport() { wx.navigateTo({ url: '/pages/report/report' }); },

  goAssessment() { wx.navigateTo({ url: '/pages/assessment/assessment' }); }
});