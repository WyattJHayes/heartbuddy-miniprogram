// pages/report/report.js —— 本周情绪周报 + 分享卡片（组件 share-card）
const app = getApp();

const MOOD_EMOJI = {
  happy: '😊', peace: '😌', anxiety: '😰', sad: '😢', lonely: '🌫', angry: '😡'
};
const MOOD_LABEL = {
  happy: '开心', peace: '平静', anxiety: '焦虑', sad: '难过', lonely: '孤独', angry: '生气'
};

// 模板名（分享文案用；绘制配色在 components/share-card 内）
const TPL_NAME = { light: '清新浅色', dark: '深夜深色' };

Page({
  data: {
    loaded: false,
    empty: true,
    topEmoji: '😌',
    topLabel: '—',
    chatCount: 0,
    dayCount: 0,
    suggestion: '',
    tpl: 'light',       // light | dark
    showShare: false,
    shareUrl: '',
    drawing: false,
    cardData: {}        // 传给 share-card 组件的数据
  },

  onLoad() {
    // 记住上次选择的模板（区别于每次默认浅色）
    const saved = wx.getStorageSync('reportTpl');
    if (saved === 'light' || saved === 'dark') this.setData({ tpl: saved });
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
        suggestion: suggestions[top] || '继续保持觉察，记录本身就是一种照顾。',
        cardData: {
          topEmoji: MOOD_EMOJI[top] || '😌',
          topLabel: MOOD_LABEL[top] || '平稳',
          chatCount: list.length,
          dayCount: days.size,
          suggestion: suggestions[top] || '继续保持觉察，记录本身就是一种照顾。'
        }
      });
    } catch (e) {
      console.error('[report] 失败', e);
      this.setData({ loaded: true });
    }
  },

  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); },

  // 复制文字版周报（答辩/聊天分享友好）
  copyWeekText() {
    const d = this.data;
    if (d.empty) {
      wx.showToast({ title: '本周还没有记录', icon: 'none' });
      return;
    }
    const text =
      ['【心语伴 · 本周情绪小报】',
       `主要情绪：${d.topLabel} ${d.topEmoji}`,
       `倾诉 ${d.chatCount} 次 · ${d.dayCount} 天有记录`,
       `给这周的你：${d.suggestion}`,
       '—— 用 AI 心理陪伴，记录你的情绪地图 🌱'].join('\n');
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制文字版', icon: 'success' })
    });
  },

  /* ---------- 分享卡片（绘制在 share-card 组件） ---------- */
  setTpl(e) {
    const tpl = e.currentTarget.dataset.tpl;
    if (tpl === this.data.tpl) return;
    this.setData({ tpl, shareUrl: '' });
    wx.setStorageSync('reportTpl', tpl); // 记住本次选择，下次默认用
    if (this.data.showShare) wx.nextTick(() => this.drawCard());
  },

  openShare() {
    this.setData({ showShare: true });
    wx.nextTick(() => this.drawCard());
  },

  closeShare() { this.setData({ showShare: false }); },
  noop() {},

  async drawCard() {
    if (this.data.drawing) return;
    this.setData({ drawing: true });
    try {
      const comp = this.selectComponent('#shareCard');
      if (!comp || !comp.draw) throw new Error('分享卡组件未就绪');
      const url = await comp.draw();
      this.setData({ shareUrl: url || '' });
    } catch (e) {
      console.error('[分享卡] 绘制失败', e);
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    } finally {
      this.setData({ drawing: false });
    }
  },

  saveCard() {
    if (!this.data.shareUrl) {
      wx.showToast({ title: '图片还没生成好，稍等', icon: 'none' });
      return;
    }
    wx.saveImageToPhotosAlbum({
      filePath: this.data.shareUrl,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (e) => {
        const msg = (e && e.errMsg) || '';
        if (msg.includes('auth deny') || msg.includes('authorize')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请到设置中开启「保存到相册」后再试。',
            confirmText: '去设置',
            success: (r) => { if (r.confirm) wx.openSetting(); }
          });
        } else {
          wx.showToast({ title: '保存失败，请重试', icon: 'none' });
        }
      }
    });
  },

  onShareAppMessage() {
    const tpl = this.data.tpl;
    return {
      title:
        '我在心语伴记下了「' + this.data.topLabel +
        '」——' + this.data.chatCount + ' 次倾诉 · ' + this.data.dayCount + ' 天记录（' +
        (TPL_NAME[tpl] || TPL_NAME.light) + '），一起来记录心情吧',
      path: '/pages/welcome/welcome'
    };
  }
});