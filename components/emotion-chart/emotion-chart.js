// components/emotion-chart/emotion-chart.js —— 通用 Canvas2D 折线图
// 属性：
//   points  [{ label, value }]  value 为 null 表示当天无记录（折线断开）
//   minY / maxY  纵轴范围（默认 1–5）
//   color   折线/数据点颜色
//   unit    纵轴数值的单位说明（如 “分”）
//   footer  底部说明文本（可选，会一并写入图片，如“本周小结：…”）
// 方法：save() 导出 PNG 并保存到相册；交互：长按同 save()
// 布局纯函数来自 utils/chart-model，便于 node 单测回归
const model = require('../../utils/chart-model');

Component({
  properties: {
    points: { type: Array, value: [] },
    minY: { type: Number, value: 1 },
    maxY: { type: Number, value: 5 },
    color: { type: String, value: '#5b8def' },
    unit: { type: String, value: '' },
    footer: { type: String, value: '' }
  },
  data: { ready: false },
  observers: {
    'points, minY, maxY, color, footer': function () {
      if (this.data.ready) this.draw();
    }
  },
  lifetimes: {
    attached() {
      this._queryCanvas();
    }
  },
  methods: {
    _queryCanvas() {
      const query = this.createSelectorQuery();
      query
        .select('#ec')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) return;
          this.canvas = res[0].node;
          this.ctx = this.canvas.getContext('2d');
          this.size = res[0].size;
          this.setData({ ready: true });
          this.draw();
        });
    },

    draw() {
      if (!this.ctx || !this.canvas) return;
      const ctx = this.ctx;
      const dpr = (wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2) || 2;
      const W = this.size.width, H = this.size.height;
      this.canvas.width = W * dpr;
      this.canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      const pts = (this.data.points || []);
      const n = pts.length;
      if (!n) { this._drawEmpty(W, H); return; }

      // footer 文本（宽屏内换行，最多 2 行）
      const footerLines = this._clipLines(this.data.footer);
      const footerH = footerLines.length ? footerLines.length * 14 + 8 : 0;

      const padL = 30, padR = 16, padT = 22, padB = 28 + footerH;
      const areaW = W - padL - padR, areaH = H - padT - padB;
      const lo = this.data.minY, hi = this.data.maxY;
      const span = hi - lo || 1;

      const X = (i) => model.pointX(i, n, padL, areaW);
      const Y = (v) => model.pointY(v, lo, span, padT, areaH);

      // 横向网格 + 左轴数值
      ctx.strokeStyle = '#e7ebf3';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      model.gridValues(lo, hi, 4).forEach((v) => {
        const yy = Y(v);
        ctx.beginPath();
        ctx.moveTo(padL, yy);
        ctx.lineTo(W - padR, yy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#b6bfd0';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Number.isInteger(v) ? String(v) : v.toFixed(1), padL - 6, yy + 3);
        ctx.setLineDash([4, 4]);
      });
      ctx.setLineDash([]);

      // 折线（跳过 null 空档）
      const color = this.data.color || '#5b8def';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      pts.forEach((p, i) => {
        if (p.value == null) { started = false; return; }
        const px = X(i), py = Y(p.value);
        if (!started) { ctx.moveTo(px, py); started = true; }
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // 数据点 + 数值 + 日期
      pts.forEach((p, i) => {
        const px = X(i);
        if (p.value != null) {
          const py = Y(p.value);
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#3e5ba3';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(Math.round(p.value)), px, py - 9);
        }
        ctx.fillStyle = '#9ca3af';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.label || '', px, H - padB + 12);
      });

      // 单位说明（左上）
      if (this.data.unit) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(this.data.unit, padL, 12);
      }

      // footer（底部多行说明，随图一起导出）
      if (footerLines.length) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        footerLines.forEach((ln, i) => {
          ctx.fillText(ln, padL, H - footerLines.length * 14 + 2 + i * 14);
        });
      }
    },

    _drawEmpty() {
      const ctx = this.ctx, W = this.size.width, H = this.size.height;
      ctx.fillStyle = '#c4c9d4';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无数据', W / 2, H / 2);
    },

    _clipLines(text) {
      if (!text) return [];
      const W = this.size ? this.size.width : 320;
      const maxW = W - 60;
      return model.clipLines(String(text), maxW, 2, (s) => this.ctx.measureText(s).width);
    },

    // 导出 PNG → 保存相册（含权限回流）
    save() {
      if (!this.canvas) {
        wx.showToast({ title: '图表还没就绪，稍候重试', icon: 'none' });
        return;
      }
      wx.canvasToTempFilePath(
        {
          canvas: this.canvas,
          success: (res) => {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
              fail: (e) => {
                if (e && e.errMsg && e.errMsg.indexOf('auth') > -1) {
                  wx.showModal({
                    title: '需要相册权限',
                    content: '请在设置中允许保存图片到相册',
                    confirmText: '去设置',
                    success: (r) => r.confirm && wx.openSetting()
                  });
                } else {
                  wx.showToast({ title: '保存失败', icon: 'none' });
                }
              }
            });
          },
          fail: () => wx.showToast({ title: '生成图片失败', icon: 'none' })
        },
        this
      );
    },

    onLongPress() { this.save(); }
  }
});