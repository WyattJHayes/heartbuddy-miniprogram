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

// 心情 → 分值（1–5，用于曲线纵轴）
const MOOD_SCORE = { happy: 5, peace: 4, angry: 3, anxiety: 2, lonely: 1.5, sad: 1 };

Page({
  data: {
    loaded: false,
    empty: true,
    statList: [],   // 各情绪占比 [{emoji,label,count,ratio}]
    recentList: [],  // 最近记录 [{time,mood,label}]
    moodLine: []     // 近 7 天 [{label,score,mood}]（无记录为 score:null）
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
      this.setData(
        { recentList: list.slice(0, 7), moodLine, empty: list.length === 0, loaded: true },
        () => this.drawChart()
      );
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
      days.push({
        label: `${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}`,
        score: null,
        mood: ''
      });
    }
    // raw 为 createdAt 降序 → 首次出现的即当天最新记录
    const seen = {};
    for (const m of raw) {
      const key = new Date(m.createdAt).toDateString();
      if (!(key in seen)) {
        seen[key] = m;
      }
    }
    // 用 toDateString 匹配（label 展示用，key 用日期字符串）
    const dayKeys = {};
    days.forEach((d, i) => { dayKeys[this.dateKey(new Date(today.getTime() - (6 - i) * DAY))] = d; });
    for (const key in seen) {
      if (dayKeys[key]) {
        const meta = MOOD_META[seen[key].mood];
        dayKeys[key].score = MOOD_SCORE[seen[key].mood] != null ? MOOD_SCORE[seen[key].mood] : 2;
        dayKeys[key].mood = (meta && meta.label) || '平静';
      }
    }
    return days;
  },

  dateKey(d) { return d.toDateString(); },

  // Canvas 2D：近 7 天心情折线 + 分值点
  drawChart() {
    const query = wx.createSelectorQuery();
    query
      .select('#moodChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const { node: canvas, size } = res[0];
        const ctx = canvas.getContext('2d');
        const dpr = (wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2) || 2;
        canvas.width = size.width * dpr;
        canvas.height = size.height * dpr;
        ctx.scale(dpr, dpr);

        const W = size.width, H = size.height;
        ctx.clearRect(0, 0, W, H);
        const padL = 30, padR = 18, padT = 22, padB = 28;
        const areaW = W - padL - padR, areaH = H - padT - padB;
        const days = this.data.moodLine;
        const n = days.length;
        if (!n) return;

        const X = (i) => padL + areaW * (n === 1 ? 0.5 : i / (n - 1));
        const Y = (s) => padT + areaH * (1 - (s - 1) / 4);

        // 网格（分值 1–5）
        ctx.strokeStyle = '#e7ebf3';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        for (let v = 1; v <= 5; v += 1) {
          ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(W - padR, Y(v)); ctx.stroke();
        }
        ctx.setLineDash([]);

        // 折线（跳过空档日）
        ctx.strokeStyle = '#5b8def';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let started = false;
        days.forEach((d, i) => {
          if (d.score == null) { started = false; return; }
          const px = X(i), py = Y(d.score);
          if (!started) { ctx.moveTo(px, py); started = true; }
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // 数据点 + 数值 + 日期
        days.forEach((d, i) => {
          const px = X(i);
          if (d.score == null) {
            ctx.fillStyle = '#9ca3af';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(d.label, px, H - padB + 12);
            return;
          }
          const py = Y(d.score);
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#5b8def';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#3e5ba3';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(Math.round(d.score)), px, py - 9);
          ctx.fillStyle = '#9ca3af';
          ctx.font = '9px sans-serif';
          ctx.fillText(d.label, px, H - padB + 12);
        });
      });
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