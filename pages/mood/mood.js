// pages/mood/mood.js —— 情绪记录 & 可视化
const app = getApp();
const { MOOD_META, MOOD_SCORE } = require('../../utils/moodscore');

// 一键快速记录（顺序即 UI 顺序）
const QUICK_ORDER = ['happy', 'peace', 'anxiety', 'sad', 'lonely', 'angry'];
const quickList = QUICK_ORDER.filter((k) => MOOD_META[k]).map((k) => ({ key: k, ...MOOD_META[k] }));

Page({
  data: {
    loaded: false,
    empty: true,
    statList: [],   // 各情绪占比 [{emoji,label,count,ratio}]
    recentList: [],  // 最近记录 [{time,mood,label}]
    moodLine: [],     // 近 7 天 [{label,value}]，无记录 value:null
    insight: '',       // 趋势的一句话 AI 解读（规则生成）
    chartFooter: '',    // 曲线图 footer（随长图一并导出）
    streak: { n: 0, today: false },  // 连续打卡天数
    quickList,           // 快速记录按钮
    quicking: ''         // 正在提交的 key
  },

  onShow() { this.fetchMoods(); },

  // 一键快速记录：直接把此刻心情写入 moods 集合
  async tapQuick(e) {
    const key = e.currentTarget.dataset.key;
    const meta = MOOD_META[key];
    if (!meta || this.data.quicking) return;
    let openid = app.globalData.openid;
    if (!openid) openid = await app.login();
    if (!openid) return;
    this.setData({ quicking: key });
    try {
      const db = wx.cloud.database();
      await db.collection('moods').add({
        data: {
          openid,
          sessionId: 'quick-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          mood: key,
          intensity: 3,
          trigger: '快速记录',
          createdAt: Date.now()
        }
      });
      wx.vibrateShort && wx.vibrateShort({ type: 'light' });
      wx.showToast({ title: meta.label + ' / 已记下', icon: 'success' });
      this.fetchMoods();
    } catch (e) {
      console.error('[mood] 快速记录失败', e);
      wx.showToast({ title: '记录失败，请重试', icon: 'none' });
    } finally {
      this.setData({ quicking: '' });
    }
  },

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
      this.setData({
        recentList: list.slice(0, 7),
        moodLine,
        insight: this.buildInsight(moodLine),
        chartFooter: this.buildChartFooter(moodLine),
        streak: this.computeStreak(raw),
        empty: list.length === 0,
        loaded: true
      });
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

  // 连续打卡：从今天（或昨天）往前数，有记录的天数
  computeStreak(raw) {
    const set = new Set();
    (raw || []).forEach((m) => set.add(new Date(m.createdAt).toDateString()));
    const DAY = 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!set.has(today.toDateString())) {
      const y = new Date(today.getTime() - DAY);
      if (!set.has(y.toDateString())) return { n: 0, today: false };
    }
    let n = 0;
    const d = new Date(today);
    while (set.has(d.toDateString())) {
      n += 1;
      d.setTime(d.getTime() - DAY);
    }
    return { n, today: set.has(today.toDateString()) };
  },

  // 趋势的一句话解读（规则生成，突出 AI 陪伴感）
  buildInsight(line) {
    const vals = (line || []).filter((d) => d.value != null).map((d) => d.value);
    if (!vals.length) return '';
    const n = vals.length;
    const half = Math.floor(n / 2);
    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const a = vals.slice(0, Math.max(1, half));
    const b = vals.slice(half);
    if (!b.length) return '';
    const d = avg(b) - avg(a);
    if (d <= -0.3) return '最近两天的曲线在往下走，好像有点累。允许自己慢下来，也可以现在就找我聊聊 🌱';
    if (d >= 0.3) return '最近情绪在回升，为你开心。记得把好心情也写进记录 🎈';
    return '这几天的情绪整体平稳，保持觉察本身就是很好的自我照顾 ✨';
  },

  // 曲线图 footer：日期区间 + 有记录天数（随长图导出，体现“周小结”）
  buildChartFooter(line) {
    const days = line || [];
    const valid = days.filter((d) => d.value != null).length;
    if (!valid) return '';
    const first = days[0] && days[0].label;
    const last = days[days.length - 1] && days[days.length - 1].label;
    return `本周心情小结 · ${first}~${last} · 记录了 ${valid} 天 · 心语伴 AI`;
  },

  // 保存“曲线+小结”为一张图片
  saveMoodSummary() {
    const chart = this.selectComponent('#moodChart');
    if (chart && chart.save) chart.save();
    else wx.showToast({ title: '图表还没就绪，稍候重试', icon: 'none' });
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