// pages/report/report.js —— 本周情绪周报 + 分享卡片（canvas 生成）
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
    suggestion: '',
    showShare: false,   // 分享卡浮层
    shareUrl: '',       // 生成的临时图片
    drawing: false
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

  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); },

  /* ---------- 分享卡片 ---------- */
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
      const canvas = await new Promise((resolve, reject) => {
        wx.createSelectorQuery()
          .select('#shareCard')
          .fields({ node: true, size: true })
          .exec((r) => {
            const info = r && r[0];
            if (info && info.node) resolve(info.node);
            else reject(new Error('canvas 未就绪'));
          });
      });

      const ctx = canvas.getContext('2d');
      const W = 620, H = 920;
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const dpr = win.pixelRatio || 2;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      // 背景渐变
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#dbe6ff');
      g.addColorStop(0.55, '#eaf2ff');
      g.addColorStop(1, '#f7fbff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // 顶栏
      ctx.fillStyle = 'rgba(91,141,239,0.10)';
      this.rr(ctx, 46, 52, W - 92, 96, 28);
      ctx.fill();
      ctx.fillStyle = '#4568c8';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('❥ 心语伴 · 本周情绪小报', 56, 112);

      // 主表情
      ctx.textAlign = 'center';
      ctx.font = '150px sans-serif';
      ctx.fillText(this.data.topEmoji, W / 2, 220);

      // 情绪标签
      ctx.fillStyle = '#3a4a63';
      ctx.font = 'bold 46px sans-serif';
      ctx.fillText('本周主要情绪：' + this.data.topLabel, W / 2, 320);

      // 数据
      ctx.fillStyle = '#5b8def';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText(String(this.data.chatCount), W / 2 - 130, 470);
      ctx.fillText(String(this.data.dayCount), W / 2 + 130, 470);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '24px sans-serif';
      ctx.fillText('次倾诉', W / 2 - 130, 510);
      ctx.fillText('天记录', W / 2 + 130, 510);

      // 分隔
      ctx.strokeStyle = 'rgba(91,141,239,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(70, 560);
      ctx.lineTo(W - 70, 560);
      ctx.stroke();

      // 建议（自动换行）
      ctx.fillStyle = '#5b6b85';
      ctx.font = '27px sans-serif';
      this.wrap(ctx, this.data.suggestion, W / 2, 620, W - 150, 40, 3);

      // 日期与底部
      const now = new Date();
      const dateStr = now.getFullYear() + '.' + (now.getMonth() + 1) + '.' + now.getDate();
      ctx.fillStyle = '#aab4c8';
      ctx.font = '22px sans-serif';
      ctx.fillText(dateStr + ' · 记录本周的每一天', W / 2, 810);
      ctx.fillText('AI 情绪陪伴 · 非医疗诊断', W / 2, 862);

      // 导出
      this.makeTemp(canvas, W, H, dpr);
    } catch (e) {
      console.error('[分享卡] 绘制失败', e);
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    } finally {
      this.setData({ drawing: false });
    }
  },

  rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  wrap(ctx, text, x, y, maxWidth, lineH, maxLines) {
    const chars = Array.from(String(text));
    let line = '', lines = [], i = 0;
    for (const c of chars) {
      if (ctx.measureText(line + c).width > maxWidth) {
        lines.push(line);
        line = c;
        if (lines.length === maxLines - 1) break;
      } else {
        line += c;
      }
      i++;
    }
    if (lines.length < maxLines) lines.push(line);
    const lastIdx = lines.length - 1;
    lines[lastIdx] = lastIdx === maxLines - 1 && i < chars.length ? lines[lastIdx] + '…' : lines[lastIdx];
    lines.forEach((ln, idx) => ctx.fillText(ln, x, y + idx * lineH));
  },

  makeTemp(canvas, W, H, dpr) {
    wx.canvasToTempFilePath({
      canvas,
      x: 0, y: 0, width: W, height: H,
      destWidth: W * dpr, destHeight: H * dpr,
      success: (res) => this.setData({ shareUrl: res.tempFilePath }),
      fail: (err) => console.error('[转图失败]', err)
    }, this);
  },

  previewCard() {
    if (this.data.shareUrl) wx.previewImage({ urls: [this.data.shareUrl] });
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
    return {
      title: '我这周的主要情绪是「' + this.data.topLabel + '」，也来记录你的心情吧',
      path: '/pages/welcome/welcome'
    };
  }
});