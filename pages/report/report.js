// pages/report/report.js —— 本周情绪周报 + 分享卡片（组件 share-card）
const app = getApp();
const { MOOD_SCORE } = require('../../utils/moodscore');

const MOOD_COLOR = { // 情绪构成条配色（自包含，不依赖外部）
  happy: '#FFB337', expect: '#FFD666', peace: '#7BC47F', tired: '#F2A65A',
  angry: '#F26D6D', anxiety: '#6FA8FF', lonely: '#9B8CCF', sad: '#7E9CD8'
};
const MOOD_EMOJI = {
  happy: '😊', peace: '😌', expect: '🌟', anxiety: '😰', sad: '😢', lonely: '🌫', tired: '😴', angry: '😡'
};
const MOOD_LABEL = {
  happy: '开心', peace: '平静', expect: '期待', anxiety: '焦虑', sad: '难过', lonely: '孤独', tired: '疲惫', angry: '生气'
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
    cardData: {},        // 传给 share-card 组件的数据
    history: [],          // 往期周报（本地缓存）
    weekAvg: null,        // 本周情绪均值
    prevAvg: null,        // 上周情绪均值
    deltaText: '',        // 与上周对比文案（↗/↘/→ +0.4 等）
    monthInfo: null,       // 月度小结 {label,total,days,top3,curAvg,delta}
    weekNote: '',        // 本周「对自己说」备注（本地周键缓存）
    weekNoteHint: '',
    bestDayText: '',     // 本周「相对最好的一天」（正向叙事）
  },

  _weekKey() {
    const d = new Date();
    const day = d.getDay() || 7;           // 周日=7
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + 1);
    return `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`;
  },

  refreshNote() {
    const key = this._weekKey();
    const raw = wx.getStorageSync('hb_weekNote') || {};
    if (raw.key === key) this.setData({ weekNote: raw.text || '' });
    else this.setData({ weekNote: '' });
  },

  // 构成一句话解读（读屏/快速理解）
  buildMixRead(counts, total) {
    const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    if (!keys.length) return '';
    const label = (k) => MOOD_LABEL[k] || k;
    if (keys.length === 1) return '这一周几乎都是「' + label(keys[0]) + '」——单色的一周，也可以很稳。';
    const top2 = keys.slice(0, 2).map((k) => label(k)).join(' + ');
    return '本周主要由「' + top2 + '」组成，共 ' + total + ' 条记录；多种情绪并存，才是真实的一周。';
  },

  // 本周情绪构成：堆叠条 + 图例（观察而不是评判）
  buildMixBar(counts, total) {
    const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 6);
    const sum = keys.reduce((a, k) => a + counts[k], 0) || 1;
    return keys.map((k) => ({
      mood: k,
      label: MOOD_LABEL[k] || k,
      emoji: MOOD_EMOJI[k] || '·',
      n: counts[k],
      pct: Math.round(counts[k] / sum * 100),
      color: MOOD_COLOR[k] || '#C6CBD9',
      w: Math.max(6, Math.round(counts[k] / total * 100)) // 最小 6% 保证可见
    }));
  },

  onNoteInput(e) {
    this.setData({ weekNote: e.detail.value });
  },

  // 近 4 周记录节奏：每周条数 + 一句趋势（不评判，只是观察）
  async fetchWeeks() {
    try {
      let openid = app.globalData.openid;
      if (!openid) openid = await app.login();
      if (!openid) return;
      const db = wx.cloud.database();
      const _ = db.command;
      const nowTs = Date.now();
      const res = await db.collection('moods')
        .where({ openid, createdAt: _.gte(nowTs - 28 * 86400000) })
        .limit(400).get();
      const bk = [0, 0, 0, 0];
      (res.data || []).forEach((m) => {
        const w = Math.floor((nowTs - m.createdAt) / (7 * 86400000));
        if (w >= 0 && w <= 3) bk[w] += 1;
      });
      const labels = ['4 周前', '3 周前', '2 周前', '上周'];
      const weekBars = [0, 1, 2, 3].map((i) => ({ label: labels[i], c: bk[i] }));
      const thisW = bk[3], lastW = bk[2];
      let weekTrend = '';
      const total4 = bk.reduce((a, b) => a + b, 0);
      if (total4 > 0) {
        if (thisW > lastW) weekTrend = '上周比前一周多了 ' + (thisW - lastW) + ' 次记录，你在更靠近自己 🌱';
        else if (thisW < lastW) weekTrend = '上周记录比前一周少了 ' + (lastW - thisW) + ' 次——忙的时候，1 分钟点一下心情也可以';
        else weekTrend = '上周和前一周差不多，保持得不错';
      }
      this.setData({ weekBars, weekTrend });
    } catch (e) { console.error('[report] 近4周失败', e); }
  },

  saveNote() {
    wx.setStorageSync('hb_weekNote', { key: this._weekKey(), text: this.data.weekNote });
    wx.showToast({ title: '备注已保存', icon: 'success' });
  },

  onLoad() {
    // 记住上次选择的模板（区别于每次默认浅色）
    const saved = wx.getStorageSync('reportTpl');
    if (saved === 'light' || saved === 'dark') this.setData({ tpl: saved });
    this.setData({ history: wx.getStorageSync('weekReportHistory') || [] });
  },

  onShow() { this.fetchWeek(); this.fetchMonth(); this.fetchWeeks(); this.refreshNote(); },

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
      // 本周/上周情绪均值（分值来自 utils/moodscore）
      const _ = db.command;
      const weekAgo2 = weekAgo - 7 * 24 * 3600 * 1000;
      const prevRes = await db.collection('moods')
        .where({ openid, createdAt: _.and(_.gte(weekAgo2), _.lt(weekAgo)) })
        .limit(100).get();
      const mean = (arr) => {
        const vals = (arr || []).map((m) => MOOD_SCORE[m.mood]).filter((v) => typeof v === 'number');
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };
      const weekAvg = mean(list);
      const prevAvg = mean(prevRes.data || []);
      // 本周平均强度（1-5，情绪滑条/快速记录 intensity）
      const wInts = list.map((m) => m.intensity).filter((v) => typeof v === 'number' && v > 0);
      const weekInt = wInts.length ? +(wInts.reduce((a, b) => a + b, 0) / wInts.length).toFixed(1) : null;
      let deltaText = '';
      if (weekAvg != null && prevAvg != null) {
        const d = +(weekAvg - prevAvg).toFixed(1);
        deltaText = d > 0.05 ? `↗ 本周较上周高 ${d}` : d < -0.05 ? `↘ 本周较上周低 ${Math.abs(d)}` : '→ 与上周基本持平';
      } else if (weekAvg != null) {
        deltaText = prevAvg == null ? '（上周无记录可对比）' : '';
      }
      // 近 7 天分日均值（分享卡折线用；list 覆盖 now-7d ~ now）
      const dayAcc = {};
      list.forEach((m) => {
        const v = MOOD_SCORE[m.mood];
        if (typeof v !== 'number') return;
        const k = new Date(m.createdAt).toDateString();
        (dayAcc[k] = dayAcc[k] || []).push(v);
      });
      const avg7 = [];
      const _td = new Date();
      for (let i = 6; i >= 0; i--) {
        const dd = new Date(_td.getFullYear(), _td.getMonth(), _td.getDate() - i);
        const arr = dayAcc[dd.toDateString()];
        avg7.push(arr && arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null);
      }

      // 本周「相对最好的一天」：近 7 天里记录均值最高且 ≥3 的那天（正向叙事，不追求绝对开心）
      let bestDayText = '';
      let bestAvg = -1, bestIdx = -1;
      avg7.forEach((v, i) => { if (v !== null && v >= 3 && v > bestAvg) { bestAvg = v; bestIdx = i; } });
      if (bestIdx >= 0) {
        const bd = new Date(_td.getFullYear(), _td.getMonth(), _td.getDate() - (6 - bestIdx));
        const wd = ['日', '一', '二', '三', '四', '五', '六'][bd.getDay()];
        const moodName = MOOD_LABEL[top];
        bestDayText = `🌟 本周相对最好的一天是周${wd}（${bd.getMonth() + 1}月${bd.getDate()}日）——那天你更多处在「${moodName}」的状态里。记住它，它会提醒你『我可以好起来』。`;
      }

      // 本周「练习足迹」：把自照顾的来源数一数（呼吸/身体扫描/其他正念）
      let practiceText = '';
      const breathN = list.filter((m) => (m.trigger || '').indexOf('呼吸') >= 0).length;
      const scanN = list.filter((m) => (m.trigger || '').indexOf('身体扫描') >= 0).length;
      const otherN = list.length - breathN - scanN;
      const parts = [];
      if (breathN) parts.push('呼吸练习 ×' + breathN);
      if (scanN) parts.push('身体扫描 ×' + scanN);
      if (parts.length) {
        const rest = otherN > 0 ? '，还有 ' + otherN + ' 次「和自己待一会儿」' : '';
        practiceText = '🌿 本周你练习了：' + parts.join(' · ') + rest;
      } else {
        practiceText = '本周想和你一起试试：睡前 3 分钟呼吸，让自己慢下来。';
      }

      // 本周一句话总结（模板自动拼词，只给叙事不给判断）
      let oneLiner = '';
      if (weekAvg != null) {
        const tone = weekAvg >= 4 ? '整体不赖' : weekAvg >= 3 ? '整体平稳' : '辛苦了一点点';
        const dir = deltaText.indexOf('↘') >= 0 ? '，比上周松快了些'
          : deltaText.indexOf('↗') >= 0 ? '，比上周更难一些'
          : deltaText.indexOf('持平') >= 0 ? '，和上周差不多' : '';
        const who = bestIdx >= 0
          ? `尤其周${['日','一','二','三','四','五','六'][new Date(_td.getFullYear(),_td.getMonth(),_td.getDate()-(6-bestIdx)).getDay()]}给了你不错的一天`
          : '没有大起大落，稳稳地撑住了';
        oneLiner = `本周：${tone}（均分 ${weekAvg.toFixed(1)}）${dir}，${who}。`;
      }

      const suggestions = {
        anxiety: '这周焦虑出现较多，试着每天睡前做 3 分钟深呼吸，把担心的事写下来。',
        sad: '这周难过占比较多，允许自己低落，也别忘了和信任的人分享一点。',
        angry: '生气的时候先离开现场 10 分钟，给情绪降个温再回来。',
        happy: '本周整体不错！继续保持，把开心的小事记下来会更好。',
        lonely: '孤独的时候试试给老朋友发条消息，哪怕只是简单问候。',
        peace: '本周情绪平稳，这是很棒的自我调节力。'
      };

      // 本周晚间小结篇数（本地小结日记，按日期落在本周一之后）
      const noteMap = wx.getStorageSync('hbDayNote') || {};
      const mon0 = new Date(); mon0.setHours(0, 0, 0, 0);
      mon0.setDate(mon0.getDate() - ((mon0.getDay() + 6) % 7));
      const weekNotes = Object.keys(noteMap).filter((k) => {
        const p2 = k.split('-').map(Number);
        if (p2.length !== 3) return false;
        return new Date(p2[0], p2[1] - 1, p2[2]) >= mon0;
      }).length;
      this.setData({
        loaded: true,
        empty: false,
        weekNotes,
        topEmoji: MOOD_EMOJI[top] || '😌',
        topLabel: MOOD_LABEL[top] || '平稳',
        chatCount: list.length,
        dayCount: days.size,
        mixBar: this.buildMixBar(counts, list.length),
        mixRead: this.buildMixRead(counts, list.length),
        suggestion: suggestions[top] || '继续保持觉察，记录本身就是一种照顾。',
        weekAvg: weekAvg != null ? weekAvg.toFixed(1) : null,
        weekInt: weekInt,
        prevAvg: prevAvg != null ? prevAvg.toFixed(1) : null,
        deltaText,
        // 连续低日提醒 + 正向鼓励条（高分接连）二选一，都不触发则都不显示
        highStreakTip: this.buildHighStreakTip(avg7),
        lowStreakTip: this.buildLowStreakTip(avg7),
        bestDayText,
        oneLiner,
        practiceText,
        cardData: {
          topEmoji: MOOD_EMOJI[top] || '😌',
          topLabel: MOOD_LABEL[top] || '平稳',
          chatCount: list.length,
          dayCount: days.size,
          suggestion: suggestions[top] || '继续保持觉察，记录本身就是一种照顾。',
          weekAvg: weekAvg != null ? weekAvg.toFixed(1) : '',
          prevAvg: prevAvg != null ? prevAvg.toFixed(1) : '',
          deltaText,
          avg7
        }
      });
      this.pushHistory({
        date: this.today() + (this.data.tpl === 'dark' ? ' · 夜' : ''),
        topEmoji: MOOD_EMOJI[top] || '😌',
        topLabel: MOOD_LABEL[top] || '平稳',
        chatCount: list.length,
        dayCount: days.size
      });
    } catch (e) {
      console.error('[report] 失败', e);
      this.setData({ loaded: true });
    }
  },

  // 正向鼓励条：最近连续 ≥3 天日均分 ≥4（4=平和/5=开心）时给一句鼓励（与低日提醒互斥）
  buildHighStreakTip(avg7) {
    let streak = 0;
    for (let i = avg7.length - 1; i >= 0; i--) {
      const v = avg7[i];
      if (v == null) break;      // 无记录的一天会截断连续
      if (v >= 4) streak += 1;
      else break;
    }
    if (streak < 3) return '';
    return streak >= 5 ? `连续 ${streak} 天状态都很不错，你有在好好照顾自己，为自己骄傲吧 🌈`
      : `最近连续 ${streak} 天都还不错，继续保持觉察，也别忘了好好吃饭 🌈`;
  },

  // 连续低日提醒：最近连续 <2.5 的记录天数 ≥2 时，给一句温和建议
  buildLowStreakTip(avg7) {
    let streak = 0;
    for (let i = avg7.length - 1; i >= 0; i--) {
      const v = avg7[i];
      if (v == null) break;      // 无记录的一天会截断连续
      if (v < 2.5) streak += 1;
      else break;
    }
    if (streak < 2) return '';
    if (streak >= 3) return `最近连续 ${streak} 天情绪都在低处，辛苦了。要不要试试 3 分钟呼吸，或来和我聊聊 🌿`;
    return '最近两天情绪偏低，别硬扛。可以到「呼吸」做 3 分钟放松，或找我聊聊 🌿';
  },

  // 月度小结：本月记录/覆盖天数/构成 Top3/与上月均值对比（与周报并行加载）
  async fetchMonth() {
    try {
      let openid = app.globalData.openid;
      if (!openid) openid = await app.login();
      if (!openid) return;
      const db = wx.cloud.database();
      const _ = db.command;
      const now = new Date();
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      const [curRes, prevRes] = await Promise.all([
        db.collection('moods').where({ openid, createdAt: _.gte(mStart) }).limit(300).get(),
        db.collection('moods').where({ openid, createdAt: _.and(_.gte(prevStart), _.lt(mStart)) }).limit(300).get()
      ]);
      const curList = curRes.data || [];
      if (!curList.length) { this.setData({ monthInfo: null }); return; }
      const counts = {}; const daySet = new Set();
      curList.forEach((m) => { counts[m.mood] = (counts[m.mood] || 0) + 1; daySet.add(new Date(m.createdAt).toDateString()); });
      const top3 = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3)
        .map((k) => ({ emoji: MOOD_EMOJI[k] || '😌', label: MOOD_LABEL[k] || '记录', count: counts[k] }));
      const mean = (arr) => {
        const v = (arr || []).map((m) => MOOD_SCORE[m.mood]).filter((x) => typeof x === 'number');
        return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null;
      };
      const curAvg = mean(curList);
      const prevAvg = mean(prevRes.data || []);
      const prevCount = (prevRes.data || []).length;
      const monthCountText = prevCount
        ? (curList.length > prevCount ? '本月 ' + curList.length + ' 条，比上月（' + prevCount + '）多了 ' + (curList.length - prevCount) + ' 条'
           : curList.length < prevCount ? '本月 ' + curList.length + ' 条，比上月（' + prevCount + '）少了 ' + (prevCount - curList.length) + ' 条——记录少一点也没关系'
           : '本月 ' + curList.length + ' 条，与上月持平')
        : '本月已记录 ' + curList.length + ' 条（上月无记录）';
      // 平均强度（chat 强度滑条 / 快速记录的 intensity 字段）
      const ints = curList.map((m) => m.intensity).filter((v) => typeof v === 'number' && v > 0);
      const avgInt = ints.length ? +(ints.reduce((a, b) => a + b, 0) / ints.length).toFixed(1) : null;
      // 情绪词云：情绪标签为主词，触发来源为辅词，字号按频次加权（纯前端统计）
      const words = Object.keys(counts).map((k) => ({
        text: MOOD_LABEL[k] || '记录', emoji: MOOD_EMOJI[k] || '😌', count: counts[k], mood: true
      }));
      const trigCounts = {};
      curList.forEach((m) => {
        const t = (m.trigger || '').trim();
        if (t) trigCounts[t] = (trigCounts[t] || 0) + 1;
      });
      Object.keys(trigCounts).forEach((t) => {
        if (!words.some((w) => w.text === t)) words.push({ text: t, emoji: '', count: trigCounts[t], mood: false });
      });
      words.sort((a, b) => b.count - a.count);
      const maxC = words.length ? words[0].count : 1;
      const cloud = words.slice(0, 10).map((w) => ({
        text: w.text, emoji: w.emoji, count: w.count,
        size: 24 + Math.round(18 * (w.count / maxC)),
        color: w.mood ? '#3f6fe0' : '#8a94a8'
      }));
      let delta = '';
      if (curAvg != null && prevAvg != null) {
        const d = +(curAvg - prevAvg).toFixed(1);
        delta = d > 0.05 ? `↗ 较上月高 ${d}` : d < -0.05 ? `↘ 较上月低 ${Math.abs(d)}` : '→ 与上月持平';
      } else if (curAvg != null) {
        delta = prevAvg == null ? '（上月无记录可对比）' : '';
      }
      this.setData({
        monthInfo: {
        monthCountText,
          label: `${now.getMonth() + 1}月`,
          total: curList.length,
          days: daySet.size,
          top3,
          curAvg,
          avgInt,
          cloud,
          delta
        }
      });
    } catch (err) {
      console.warn('[report] 月度小结失败', err);
    }
  },

  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); },

  today() {
    const d = new Date();
    const p = (x) => (x < 10 ? '0' + x : x);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  // 往期周报（本地缓存最多 12 条，同一周覆写）
  pushHistory(item) {
    if (!item || !item.date) return;
    const list = (wx.getStorageSync('weekReportHistory') || []).filter((x) => x.date !== item.date);
    list.unshift(item);
    const kept = list.slice(0, 12);
    wx.setStorageSync('weekReportHistory', kept);
    this.setData({ history: kept });
  },

  // 复制月度小结文字版（给老师/家长看整体状态，不泄露对话内容）
  copyMonthText() {
    const m = this.data.monthInfo;
    if (!m) { wx.showToast({ title: '本月还没有记录', icon: 'none' }); return; }
    const top = (m.top3 || []).map((t) => t.label + ' ' + t.count + ' 次').join('、');
    const delta = m.delta ? '（较上月 ' + m.delta + '）' : '';
    const txt = [
      '【' + m.label + ' 心情小结 · 来自心语伴】',
      '这个月记录了 ' + m.total + ' 条心情，覆盖 ' + m.days + ' 天' + delta,
      '出现最多：' + (top || '暂无'),
      '情绪有起伏很正常，记录本身就是一种照顾。'
    ].join('\n');
    wx.setClipboardData({ data: txt, success: () => wx.showToast({ title: '已复制月度小结', icon: 'success' }) });
  },

  // 复制文字版周报（答辩/聊天分享友好；含本周晚间小结篇数）
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
       ...(d.weekNotes ? [`晚间小结 ${d.weekNotes} 篇`] : []),
       ...(d.practiceText ? [`${d.practiceText}`] : []),
       `给这周的你：${d.suggestion}`,
       ...(d.weekNote ? [`对自己说：${d.weekNote}`] : []),
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
      // 打开时再合并最新「本周对自己说」，保证卡片上的备注是刚写的
      this.setData({ cardData: Object.assign({}, this.data.cardData, { weekNote: this.data.weekNote }) });
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
    wx.setStorageSync('ach_share', true); // 成就：迈向分享
    const tpl = this.data.tpl;
    return {
      title:
        '我在心语伴记下了「' + this.data.topLabel +
        '」——' + this.data.chatCount + ' 次倾诉 · ' + this.data.dayCount + ' 天记录（' +
        (TPL_NAME[tpl] || TPL_NAME.light) + '），一起来记录心情吧',
      path: '/pages/welcome/welcome?src=share'
    };
  }
});