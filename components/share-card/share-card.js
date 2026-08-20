// components/share-card/share-card.js —— 周报分享卡（Canvas 2D 双模板）
// 属性： card{topEmoji,topLabel,chatCount,dayCount,suggestion}  tpl('light'|'dark')
// 方法： draw() → Promise<string>  返回临时图片路径； 长按画布 → 预览/保存
const TPL = {
  light: {
    bg: ['#dbe6ff', '#eaf2ff', '#f7fbff'],
    ink: '#3a4a63', accent: '#4568c8', accentBar: 'rgba(91,141,239,0.10)',
    data: '#5b8def', muted: '#9ca3af', sub: '#5b6b85',
    line: 'rgba(91,141,239,0.25)', foot: '#aab4c8'
  },
  dark: {
    bg: ['#0f1f3a', '#16264d', '#1d3466'],
    ink: '#eef3ff', accent: '#9cc3ff', accentBar: 'rgba(156,195,255,0.14)',
    data: '#9cc3ff', muted: '#7c97b8', sub: '#c3cde6',
    line: 'rgba(156,195,255,0.30)', foot: '#7c97b8'
  }
};

Component({
  properties: {
    card: { type: Object, value: {} },
    tpl: { type: String, value: 'light' }
  },
  observers: {
    'card, tpl': function () {
      if (this._ready && this.canvas) this.renderCard();
    }
  },
  lifetimes: {
    attached() {
      this._initCanvas().then(() => {
        if (this.canvas) this.renderCard();
      });
    }
  },
  methods: {
    _initCanvas() {
      if (this.canvas) return Promise.resolve();
      if (this._canvasP) return this._canvasP;
      this._canvasP = new Promise((resolve) => {
        this.createSelectorQuery()
          .select('#share')
          .fields({ node: true, size: true })
          .exec((r) => {
            const info = r && r[0];
            if (info && info.node) {
              this.canvas = info.node;
              this._ready = true;
            }
            resolve();
          });
      });
      return this._canvasP;
    },

    renderCard() {
      return this._initCanvas().then(() => {
        if (!this.canvas) throw new Error('canvas 未就绪');
        const ctx = this.canvas.getContext('2d');
        const W = 620, H = 920;
        const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const dpr = win.pixelRatio || 2;
        this.canvas.width = W * dpr;
        this.canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        const cd = this.data.card || {};
        const t = TPL[this.data.tpl] || TPL.light;

        const g = ctx.createLinearGradient(0, 0, 0, H);
        t.bg.forEach((c, i) => g.addColorStop(i / (t.bg.length - 1), c));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // 顶栏
        ctx.fillStyle = t.accentBar;
        this._rr(ctx, 46, 52, W - 92, 96, 28);
        ctx.fill();
        ctx.fillStyle = t.accent;
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('❥ 心语伴 · 本周情绪小报', 56, 112);

        // 主表情
        ctx.textAlign = 'center';
        ctx.font = '150px sans-serif';
        ctx.fillText(cd.topEmoji || '😌', W / 2, 220);

        // 情绪标签
        ctx.fillStyle = t.ink;
        ctx.font = 'bold 46px sans-serif';
        ctx.fillText('本周主要情绪：' + (cd.topLabel || '—'), W / 2, 320);

        // 数据
        ctx.fillStyle = t.data;
        ctx.font = 'bold 64px sans-serif';
        ctx.fillText(String(cd.chatCount || 0), W / 2 - 130, 470);
        ctx.fillText(String(cd.dayCount || 0), W / 2 + 130, 470);
        ctx.fillStyle = t.muted;
        ctx.font = '24px sans-serif';
        ctx.fillText('次倾诉', W / 2 - 130, 510);
        ctx.fillText('天记录', W / 2 + 130, 510);

        // 分隔线
        ctx.strokeStyle = t.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(70, 560);
        ctx.lineTo(W - 70, 560);
        ctx.stroke();

        // 建议（自动换行）
        ctx.fillStyle = t.sub;
        ctx.font = '27px sans-serif';
        this._wrap(ctx, cd.suggestion || '', W / 2, 620, W - 150, 40, 3);

        // 日期与底部
        const now = new Date();
        const dateStr = now.getFullYear() + '.' + (now.getMonth() + 1) + '.' + now.getDate();
        ctx.fillStyle = t.foot;
        ctx.font = '22px sans-serif';
        ctx.fillText(dateStr + ' · 记录这周的每一天', W / 2, 810);
        ctx.fillText('AI 情绪陪伴 · 非医疗诊断', W / 2, 862);

        return this._toTemp(W, H, dpr);
      });
    },

    _toTemp(W, H, dpr) {
      return new Promise((resolve, reject) => {
        wx.canvasToTempFilePath(
          {
            canvas: this.canvas,
            x: 0, y: 0, width: W, height: H,
            destWidth: W * dpr, destHeight: H * dpr,
            success: (res) => resolve(res.tempFilePath),
            fail: (err) => reject(err)
          },
          this
        );
      });
    },

    // 长按 → 画成图片 → 全屏预览（可保存）
    preview() {
      if (!this.canvas) return;
      this.renderCard().then((url) => {
        if (url) wx.previewImage({ urls: [url] });
      });
    },

    _rr(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },

    _wrap(ctx, text, x, y, maxWidth, lineH, maxLines) {
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
      if (lastIdx === maxLines - 1 && i < chars.length) lines[lastIdx] += '…';
      lines.forEach((ln, idx) => ctx.fillText(ln, x, y + idx * lineH));
    }
  }
});