// pages/report/report.js —— 本周情绪周报
const app = getApp();

const MOOD_EMOJI = {
  happy: '😊', peace: '😌', anxiety: '😰', sad: '😢', lonely: '🌫', angry: '😡'
};
const MOOD_LABEL = {
  happy: '开心', peace: '平静', anxiety: '焦虑', sad: '难过', lonely: '孤独', angry: '生气'
};

Page({
  data: {
    loaded: false,
    empty: true,
    topEmoji: '😌',
    topLabel: '—',
    chatCount: 0,
    dayCount: 0,
    suggestion: ''
  },

  onShow() { this.fetchWeek(); },

  async fetchWeek() {
    let openid = app.globalData.openid;
    if (!openid) openid = await app.login();
    if (!openid) return;

    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    try {
      const db = wx.cloud.database();
      const res = await db
        .collection('moods')
        .where({ openid, createdAt: db.command.gte(weekAgo) })
        .limit(100)
        .get();

      const list = res.data || [];
      if (!list.length) {
        this.setData({ loaded: true, empty: true });
        return;
      }

      const counts = {};
      const days = new Set();
      list.forEach((m) => {
        counts[m.mood] = (counts[m.mood] || 0) + 1;
        days.add(new Date(m.createdAt).toDateString());
      });

      const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'peace';
      const suggestions = {
        anxiety: '这周焦虑出现较多，试着每天睡前做 3 分钟深呼吸，把担心的事写下来。',
        sad: '这周难过占比较多，允许自己低落，也别忘了和信任的人分享一点。',
        angry: '生气的时候先离开现场 10 分钟，给情绪降个温再回来。',
        happy: '本周整体不错！继续保持，把开心的小事记下来会更好。',
        lonely: '孤独的时候试试给老朋友发条消息，哪怕只是简单问候。',
        peace: '本周情绪平稳，这是很棒的自我调节力。'
      };

      this.setData({
        loaded: true,
        empty: false,
        topEmoji: MOOD_EMOJI[top] || '😌',
        topLabel: MOOD_LABEL[top] || '平稳',
        chatCount: list.length,
        dayCount: days.size,
        suggestion: suggestions[top] || '继续保持觉察，记录本身就是一种照顾。'
      });
    } catch (e) {
      console.error('[report] 失败', e);
      this.setData({ loaded: true });
    }
  },

  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); }
});