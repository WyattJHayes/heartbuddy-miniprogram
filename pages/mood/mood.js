// pages/mood/mood.js —— 情绪记录 & 可视化
const app = getApp();

const MOOD_META = {
  happy: { emoji: '😊', label: '开心' },
  peace: { emoji: '😌', label: '平静' },
  anxiety: { emoji: '😰', label: '焦虑' },
  sad: { emoji: '😢', label: '难过' },
  lonely: { emoji: '🌫', label: '孤独' },
  angry: { emoji: '😡', label: '生气' }
};

Page({
  data: {
    loaded: false,
    empty: true,
    statList: [],   // 各情绪占比 [{emoji,label,count,ratio}]
    recentList: []  // 最近记录 [{time,mood,label}]
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

      const list = (res.data || []).map((m) => {
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
      this.setData({ recentList: list.slice(0, 7), empty: list.length === 0, loaded: true });
    } catch (e) {
      console.error('[mood] 读取失败', e);
      this.setData({ loaded: true });
    }
  },

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