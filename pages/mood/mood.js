// pages/mood/mood.js —— 情绪记录 & 可视化
const app = getApp();
const { MOOD_META, MOOD_SCORE } = require('../../utils/moodscore');
const planlib = require('../../utils/plan');

// 一键快速记录（顺序即 UI 顺序）
const QUICK_ORDER = ['happy', 'peace', 'expect', 'tired', 'anxiety', 'sad', 'lonely', 'angry'];
const quickList = QUICK_ORDER.filter((k) => MOOD_META[k]).map((k) => ({ key: k, ...MOOD_META[k] }));

Page({
  data: {
    loaded: false,
    empty: true,
    statList: [],   // 各情绪占比 [{emoji,label,count,ratio}]
    recentList: [],  // 最近记录 [{time,mood,label}]
    moodLine: [],     // 近 7 天 [{label,value}]，无记录 value:null
    healthIdx: null,     // 情绪健康指数 {score,emoji,label,note,deltaText}
    insight: '',       // 趋势的一句话 AI 解读（规则生成）
    weekSum: '',       // 本周小结（规则生成的完整文案）
    chartFooter: '',    // 曲线图 footer（随长图一并导出）
    streak: { n: 0, today: false },  // 连续打卡天数
    quickList,           // 快速记录按钮
    quicking: '',        // 正在提交的 key
    plan: null,          // 3 天陪伴计划（评测页生成，本地共享）
    planIdx: -1,
    planAllDone: false,
    // 时光信：写给 7 天后的自己（本地保存）
    letter: null,        // { content, createdAt }
    letterDue: -1,       // 已过天数（-1 表示还未写信）
    letterReady: false,  // 已到期可拆开
    letterText: '',
    // 每日心情提醒（本地弱提醒，无模板订阅）
    remindOn: false,
    remindTime: '20:00',
    demoBusy: false,
    // 情绪日记：详情弹层
    detail: null,        // { _id, time, label, emoji, intensity, trigger }
    showDetail: false,
    deleting: false,
    // 心情日历（月视图签到）
    calYear: 0,
    calMonth: 0,          // 1-12
    calCells: [],         // [{num,inMonth,emoji,count,isToday,key}]
    calWeekday: ['日', '一', '二', '三', '四', '五', '六'],
    calTitle: '',
    calDay: null,          // 点选某天后的当日小结
    smalls: [],            // 今日三件小事 [{i,text,done}]
    smallCelebrate: false, // 三件全完成时的庆祝条
    band: [],              // 近 14 天情绪色带 [{d,e,has}]
    todayTip: false        // 今日未记录心情时的轻提醒（当天一次可关）
  },

  onShow() {
    this.fetchMoods();
    this.refreshPlan();
    this.refreshLetter();
    this.refreshRemind();
    this.refreshSmall();
  },

  // ---- 今日三件小事：每天 3 条「为自己做的小事」，可勾选打卡（本地）----
  _toKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  },

  refreshSmall() {
    const today = this._toKey();
    let items = [{ text: '', done: false }, { text: '', done: false }, { text: '', done: false }];
    const raw = wx.getStorageSync('hb_small');
    if (raw && raw.date === today && Array.isArray(raw.items) && raw.items.length === 3) {
      items = raw.items;
    }
    const all = items.filter((x) => x.done).length === 3 && items.some((x) => x.text);
    this.setData({ smalls: items.map((x, i) => Object.assign({ i }, x)), smallCelebrate: all });
  },

  onSmallInput(e) {
    const items = this.data.smalls.slice();
    const i = Number(e.currentTarget.dataset.i);
    if (items[i]) items[i].text = e.detail.value;
    this.setData({ smalls: items });
  },

  onSmallDone(e) {
    const items = this.data.smalls.slice();
    const i = Number(e.currentTarget.dataset.i);
    if (!items[i]) return;
    items[i].done = !items[i].done;
    this.setData({ smalls: items });
    const all = items.filter((x) => x.done).length === 3 && items.some((x) => x.text);
    if (all) {
      wx.setStorageSync('ach_small_three', true);
      wx.showToast({ title: '三件小事都完成 ✨', icon: 'success' });
    }
    this.setData({ smallCelebrate: all });
    this.saveSmall();
  },

  saveSmall() {
    wx.setStorageSync('hb_small', { date: this._toKey(), items: this.data.smalls.map((x) => ({ text: x.text, done: x.done })) });
  },

  // ---- 每日心情提醒（本地轻提醒：打开应用时若到点且今日未提醒则提示一次）----
  refreshRemind() {
    const cfg = wx.getStorageSync('moodRemind') || {};
    const on = !!cfg.on, time = cfg.time || '20:00';
    this.setData({ remindOn: on, remindTime: time });
    if (!on) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const last = wx.getStorageSync('moodRemindLast');
    if (last === today) return;
    const [h, m] = (time || '20:00').split(':').map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const targetMin = (h || 20) * 60 + (m || 0);
    if (nowMin >= targetMin) {
      wx.setStorageSync('moodRemindLast', today);
      wx.showModal({
        title: '🌙 该记录今天的情绪了',
        content: '花 3 秒点一个心情，让心语伴知道今天的你。',
        confirmText: '去记录',
        cancelText: '晚点再说',
        success: (r) => { if (r.confirm) { this.setData({ quicking: '' }); wx.vibrateShort && wx.vibrateShort({ type: 'light' }); } }
      });
    }
  },

  toggleRemind(e) {
    const on = e.detail.value;
    this.setData({ remindOn: on });
    wx.setStorageSync('moodRemind', { on, time: this.data.remindTime });
    wx.showToast({ title: on ? '已开启每日提醒' : '已关闭提醒', icon: 'none' });
  },

  onRemindTime(e) {
    this.setData({ remindTime: e.detail.value });
    if (this.data.remindOn) wx.setStorageSync('moodRemind', { on: true, time: e.detail.value });
  },

  // 日记：点开 / 长按查看当日记录详情
  noop() {},

  openDetail(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    this.setData({ detail: item, showDetail: true });
  },

  closeDetail() {
    if (this.data.deleting) return;
    this.setData({ showDetail: false, detail: null });
  },

  async deleteDetail() {
    const d = this.data.detail;
    if (!d || !d._id || this.data.deleting) return;
    try {
      this.setData({ deleting: true });
      const db = wx.cloud.database();
      await db.collection('moods').doc(d._id).remove();
      wx.showToast({ title: '已删除这条记录', icon: 'success' });
      this.setData({ showDetail: false, detail: null });
      this.fetchMoods(true);
    } catch (err) {
      console.error('[mood] 删除失败', err);
      wx.showToast({ title: '删除失败，请重试', icon: 'none' });
    } finally {
      this.setData({ deleting: false });
    }
  },
  genDemo() {
    if (this.data.demoBusy) return;
    wx.showModal({
      title: '填充示例数据？',
      content: '将为你写入 12 条示例心情（标记为“演示数据”），方便现场演示曲线/周小结/本周小结。可随时一键清除。',
      confirmText: '填充',
      success: async (r) => {
        if (!r.confirm) return;
        this.setData({ demoBusy: true });
        wx.showLoading({ title: '写入中…' });
        let openid = app.globalData.openid;
        if (!openid) openid = await app.login();
        if (!openid) { wx.hideLoading(); this.setData({ demoBusy: false }); return; }
        const seq = [['happy', 5, 2], ['happy', 5, 3], ['peace', 4, 4], ['anxiety', 8, 2], ['lonely', 11, 2], ['sad', 12, 10], ['sad', 13, 6], ['anxiety', 15, 1], ['peace', 16, 4], ['happy', 17, 3], ['peace', 20, 2], ['happy', 21, 3]];
        try {
          const db = wx.cloud.database();
          const now = Date.now();
          for (let i = 0; i < seq.length; i++) {
            const [mood, daysAgo, intensity] = seq[i];
            await db.collection('moods').add({
              data: {
                openid,
                sessionId: 'demo-' + now + '-' + i,
                mood,
                intensity,
                trigger: '演示数据',
                createdAt: now - daysAgo * 86400000
              }
            });
          }
          await this.fetchMoods(true);
          wx.showToast({ title: '已写入 12 条演示记录', icon: 'success' });
        } catch (e) {
          console.error('[mood] 演示数据失败', e);
          wx.showToast({ title: '写入失败，请重试', icon: 'none' });
        } finally {
          wx.hideLoading();
          this.setData({ demoBusy: false });
        }
      }
    });
  },

  clearDemo() {
    if (this.data.demoBusy) return;
    wx.showModal({
      title: '清除示例数据？',
      content: '只删除 sessionId 以 demo- 开头的记录，你自己的真实记录不受影响。',
      confirmText: '清除',
      success: async (r) => {
        if (!r.confirm) return;
        this.setData({ demoBusy: true });
        wx.showLoading({ title: '清除中…' });
        let openid = app.globalData.openid;
        if (!openid) openid = await app.login();
        if (!openid) { wx.hideLoading(); this.setData({ demoBusy: false }); return; }
        try {
          const db = wx.cloud.database();
          const regexp = db.RegExp({ regexp: '^demo-' });
          let removed = 0;
          // 云端每次最多取 20 条，循环清理
          while (true) {
            const r = await db.collection('moods')
              .where({ openid, sessionId: db.command.regexp(regexp) })
              .limit(20)
              .get();
            if (!r.data || !r.data.length) break;
            for (const doc of r.data) {
              await db.collection('moods').doc(doc._id).remove();
              removed += 1;
            }
            if (r.data.length < 20) break;
          }
          wx.hideLoading();
          wx.showToast({ title: `已清除 ${removed} 条示例`, icon: 'success' });
          this.fetchMoods(true);
        } catch (e) {
          wx.hideLoading();
          console.error('[mood] 清除失败', e);
          wx.showToast({ title: '清除失败，请重试', icon: 'none' });
        } finally {
          this.setData({ demoBusy: false });
        }
      }
    });
  },

  // ---- 时光信：写给 7 天后的自己 ----
  refreshLetter() {
    const raw = wx.getStorageSync('timeLetter');
    if (!raw || !raw.content) { this.setData({ letter: null, letterReady: false, letterDue: -1 }); return; }
    const due = Math.floor((Date.now() - raw.createdAt) / 86400000);
    this.setData({ letter: raw, letterDue: due, letterReady: due >= 7 });
  },

  onLetterInput(e) { this.setData({ letterText: e.detail.value }); },

  sendLetter() {
    const content = (this.data.letterText || '').trim();
    if (!content) { wx.showToast({ title: '先写点什么吧', icon: 'none' }); return; }
    wx.showModal({
      title: '寄出这封信？',
      content: '寄出后 7 天才能打开，那一天的你会收到此刻的心情。',
      confirmText: '寄出',
      success: (res) => {
        if (!res.confirm) return;
        wx.setStorageSync('timeLetter', { content, createdAt: Date.now() });
        if (!wx.getStorageSync('ach_letter')) wx.setStorageSync('ach_letter', true); // 成就：写给未来的自己
        this.setData({ letterText: '', letter: { content, createdAt: Date.now() }, letterDue: 0, letterReady: false });
        wx.showToast({ title: '已寄出，7 天后见', icon: 'success' });
      }
    });
  },

  openLetter() {
    const l = this.data.letter;
    if (!l) return;
    wx.showModal({
      title: `第 ${this.data.letterDue} 天 · 来自 7 天前的你`,
      content: l.content,
      showCancel: false,
      confirmText: '收到'
    });
  },

  refreshPlan() {
    const p = planlib.load();
    if (!p) { this.setData({ plan: null }); return; }
    this.setData({ plan: p, planIdx: planlib.activeIndex(p), planAllDone: planlib.activeIndex(p) >= p.days.length });
  },

  // 今日任务打卡（与测评页共享同一份计划）
  togglePlanDay() {
    const p = this.data.plan;
    const i = this.data.planIdx;
    if (!p || i < 0 || i >= p.days.length) return;
    p.done[i] = !p.done[i];
    wx.setStorageSync('companionPlan', p);
    this.refreshPlan();
    if (p.done[i]) {
      wx.vibrateShort && wx.vibrateShort({ type: 'light' });
      wx.showToast({ title: '今日任务完成 ✓', icon: 'success' });
    }
  },

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
      if (!wx.getStorageSync('ach_firstRecord')) wx.setStorageSync('ach_firstRecord', true); // 成就：走出第一步
      wx.setStorageSync('hb_lastMoodDate', new Date().toDateString()); // 供 chat 晨间提醒判断
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
          _id: m._id,
          time: `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
          fullTime: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
          label: meta.label,
          emoji: meta.emoji,
          intensity: m.intensity || 0,
          trigger: m.trigger || ''
        };
      });

      this.renderStats(list);
      const moodLine = this.buildLine(raw);
      const streakNow = this.computeStreak(raw);
      if (streakNow.n >= 3 && !wx.getStorageSync('ach_streak3')) {
        wx.setStorageSync('ach_streak3', true); // 成就：坚持 3 天
      }
      if (streakNow.n >= 7 && !wx.getStorageSync('ach_streak7')) {
        wx.setStorageSync('ach_streak7', true); // 成就：坚持 7 天
      }
      this.setData({
        recentList: list.slice(0, 7),
        moodLine,
        insight: this.buildInsight(raw),
        healthIdx: this.buildHealth(moodLine),
        band: this.buildBand(raw),
        chartFooter: this.buildChartFooter(moodLine),
        weekSum: this.buildWeekSum(list),
        streak: streakNow,
        empty: list.length === 0,
        loaded: true,
        todayTip: this.shouldShowTodayTip(raw)
      });
      this._raw = raw;
      this.buildCal(raw);
    } catch (e) {
      console.error('[mood] 读取失败', e);
      this.setData({ loaded: true });
    }
  },

  // 情绪健康指数：❓ 说明（规则透明度，避免用户以为是指标病）
  showHealthHelp() {
    wx.showModal({
      title: '情绪健康指数是什么',
      content: '它基于你最近 7 天的情绪记录算出一个 0-100 的参考值：越平静、越接近开心的日子越多，分数越高。它只是帮助你回看自己的趋势，不代表任何诊断，分数低也不等于「有问题」。',
      showCancel: false,
      confirmText: '明白啦'
    });
  },

  // 连续卡「去记一条今日」：回到顶部一键快速记录区
  goRecordToday() {
    if (wx.pageScrollTo) {
      wx.pageScrollTo({ scrollTop: 0, duration: 300 });
      wx.showToast({ title: '在上面选一个心情就好啦', icon: 'none' });
    }
  },

  // 今日是否显示「还未记录」轻提醒：当天一次、可关、随记录自动消失
  shouldShowTodayTip(raw) {
    if (wx.getStorageSync('hb_moodTipDismiss') === new Date().toDateString()) return false;
    const now = new Date();
    const sameDay = (t) => {
      const d = new Date(t);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    };
    return !(raw || []).some((m) => m.createdAt && sameDay(m.createdAt));
  },

  dismissTodayTip() {
    wx.setStorageSync('hb_moodTipDismiss', new Date().toDateString());
    this.setData({ todayTip: false });
  },

  // ---- 心情日历（月视图签到：按月看每天记了什么）----
  buildCal(raw) {
    let y = this.data.calYear, m = this.data.calMonth;
    if (!y || !m) {
      const now = new Date();
      y = now.getFullYear();
      m = now.getMonth() + 1;
    }
    const rawArr = raw || this._raw || [];
    // dateKey -> {emoji, count}
    const map = {};
    rawArr.forEach((r) => {
      const d = new Date(r.createdAt);
      const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (!map[k]) map[k] = { emoji: (MOOD_META[r.mood] || MOOD_META.peace).emoji, count: 0 };
      map[k].count += 1;
    });
    const firstDow = new Date(y, m - 1, 1).getDay(); // 0=周日
    const total = new Date(y, m, 0).getDate();
    const prevTotal = new Date(y, m - 1, 0).getDate();
    const now = new Date();
    const todayK = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const cells = [];
    const dayKey = (yy, mm, dd) => `${yy}-${mm}-${dd}`;
    // 上月补齐
    for (let i = firstDow - 1; i >= 0; i--) {
      const d = prevTotal - i;
      const ny = m === 1 ? y - 1 : y, nm = m === 1 ? 12 : m - 1;
      const k = dayKey(ny, nm, d);
      cells.push({ num: d, inMonth: false, emoji: (map[k] || {}).emoji || '', count: (map[k] || {}).count || 0, isToday: false, key: k });
    }
    // 本月
    for (let d = 1; d <= total; d++) {
      const k = dayKey(y, m, d);
      cells.push({ num: d, inMonth: true, emoji: (map[k] || {}).emoji || '', count: (map[k] || {}).count || 0, isToday: k === todayK, key: k });
    }
    // 下月补齐（凑满整周）
    let trailingDay = 1;
    while (cells.length % 7 !== 0) {
      const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
      cells.push({ num: trailingDay, inMonth: false, emoji: '', count: 0, isToday: false, key: `${nm}-${trailingDay}` });
      trailingDay += 1;
    }
    this.setData({
      calYear: y,
      calMonth: m,
      calCells: cells,
      calTitle: `${y} 年 ${m} 月`
    });
  },

  calNav(e) {
    const d = Number(e.currentTarget.dataset.d) || 0;
    let y = this.data.calYear, m = this.data.calMonth;
    m += d;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    this.setData({ calYear: y, calMonth: m, calDay: null });
    this.buildCal();
  },

  onCalDay(e) {
    const k = e.currentTarget.dataset.k;
    const cell = this.data.calCells.find((c) => c.key === k);
    if (!cell || !cell.count) { wx.showToast({ title: '这天还没有记录', icon: 'none' }); return; }
    // 汇总当日各情绪
    const raw = this._raw || [];
    const names = {};
    raw.forEach((r) => {
      const d = new Date(r.createdAt);
      const ck = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (ck !== k) return;
      const meta = MOOD_META[r.mood] || MOOD_META.peace;
      names[meta.label] = (names[meta.label] || 0) + 1;
    });
    const list = Object.keys(names).map((label) => ({ label, count: names[label] })).sort((a, b) => b.count - a.count);
    this.setData({ calDay: { date: k, total: cell.count, list } });
  },

  closeCalDay() {
    this.setData({ calDay: null });
  },

  // 日历长按某天 → 复用色带的管理菜单（查看/编辑补记、删除当天最新一条）
  onCalLongPress(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ calDay: null });
    // 把「Y-M-D」转成颜色带用的「M/D」标签
    const parts = String(k).split('-').map((x) => Number(x));
    const d = parts.length === 3 ? `${parts[1]}/${parts[2]}` : k;
    this.longpressBand({ currentTarget: { dataset: { k, d } } });
  },

  // 近 14 天情绪色带：每天取当天最新一条的 emoji，无记录则留空
  buildBand(raw) {
    const dayMap = {};
    (raw || []).forEach((m) => {
      const k = new Date(m.createdAt).toDateString();
      if (!(k in dayMap)) {
        const meta = MOOD_META[m.mood];
        dayMap[k] = meta ? meta.emoji : '·';
      }
    });
    const band = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const k = d.toDateString();
      band.push({ d: `${d.getMonth() + 1}/${d.getDate()}`, k: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, e: dayMap[k] || '', has: !!dayMap[k] });
    }
    return band;
  },

  // 点色带某天 → 弹当日心情小结，并可顺手写一句当日补记（落库到当天最新一条 mood）
  tapBand(e) {
    const k = e.currentTarget.dataset.k;
    const d = e.currentTarget.dataset.d;
    const raw = this._raw || [];
    const names = {};
    let total = 0;
    let latest = null; // 当天最新一条（用于挂补记 note）
    raw.forEach((r) => {
      const dt = new Date(r.createdAt);
      const ck = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
      if (ck !== k) return;
      const meta = MOOD_META[r.mood] || MOOD_META.peace;
      names[meta.label] = (names[meta.label] || 0) + 1;
      total++;
      if (!latest || r.createdAt > latest.createdAt) latest = r;
    });
    if (!total) { wx.showToast({ title: '这天还没有记录，先点一个心情吧', icon: 'none' }); return; }
    const line = Object.keys(names).map((label) => `${label} × ${names[label]}`).join('、');
    const hasNote = latest && latest.note;
    // 情绪笔记回看：有补记时先看到「之前写」，可再次编辑覆盖
    wx.showModal({
      title: `${d} · 心情小结`,
      content: `共 ${total} 条记录：${line}${hasNote ? `\n\n💬 之前写：「${latest.note}」` : ''}${
        hasNote ? '\n\n想改一改？在下面直接重写即可（会替换这句）。' : '\n\n想写一句当天的话？在下面写吧。'
      }`,
      editable: true,
      placeholderText: hasNote ? '再次写下这句（会替换上一条）' : '写一句给当天的自己…（可留空关闭）',
      confirmText: '写一句',
      cancelText: '关闭',
      success: async (r) => {
        const text = (r.content || '').trim();
        if (!r.confirm || !text || !latest) return;
        await this.saveDayNote(latest, text, d);
      }
    });
  },

  // 当日情绪补记：把一句话写进当天最新一条 moods 的 note 字段，并标记 trigger（保留原触发词）
  async saveDayNote(latest, text, d) {
    if (!latest || !latest._id) return;
    wx.showLoading({ title: '保存中…' });
    try {
      const db = wx.cloud.database();
      await db.collection('moods').doc(latest._id).update({
        data: {
          note: text,
          noteAt: Date.now(),
          trigger: latest.trigger && latest.trigger !== '日记补记' ? latest.trigger : '日记补记',
          prevTrigger: latest.trigger && latest.trigger !== '日记补记' ? latest.trigger : ''
        }
      });
      if (!latest.note) latest.note = text;
      wx.hideLoading();
      wx.showToast({ title: `已为 ${d} 写下这句 ✍️`, icon: 'success' });
      this.fetchMoods();
    } catch (err) {
      wx.hideLoading();
      console.error('[mood] 补记失败', err);
      wx.showToast({ title: '写入失败，请重试', icon: 'none' });
    }
  },

  // 顶部「✍️ 写一句」：补今天
  writeNoteToday() {
    const today = this.data.band[this.data.band.length - 1];
    if (today) this.tapBand({ currentTarget: { dataset: { k: today.k, d: today.d } } });
  },

  // 长按色带某天 → 操作菜单：查看/编辑补记、删除当天最新一条记录
  longpressBand(e) {
    const k = e.currentTarget.dataset.k;
    const d = e.currentTarget.dataset.d;
    const raw = this._raw || [];
    let latest = null;
    let hasNote = false;
    raw.forEach((r) => {
      const dt = new Date(r.createdAt);
      const ck = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
      if (ck !== k) return;
      if (!latest || r.createdAt > latest.createdAt) latest = r;
    });
    if (!latest || !latest._id) {
      wx.showToast({ title: '这天还没有记录', icon: 'none' });
      return;
    }
    hasNote = !!latest.note;
    const items = [
      ...(hasNote ? ['查看 / 编辑这句补记'] : []),
      '删除当天最新一条记录',
      '取消'
    ];
    wx.showActionSheet({
      itemList: items,
      success: async (r) => {
        const pick = items[r.tapIndex];
        if (pick === '查看 / 编辑这句补记') {
          this.tapBand(e); // 复用编辑弹窗（已显示「之前写」）
        } else if (pick === '删除当天最新一条记录') {
          await this.deleteDayNote(latest, d);
        }
      }
    });
  },

  // 删除当天最新一条 moods 记录（轻量管理）
  async deleteDayNote(latest, d) {
    wx.showModal({
      title: `删除 ${d} 的记录？`,
      content: '将删除当天最新一条心情记录，删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#e74c3c',
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: '删除中…' });
        try {
          const db = wx.cloud.database();
          await db.collection('moods').doc(latest._id).remove();
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          this.fetchMoods();
        } catch (err) {
          wx.hideLoading();
          console.error('[mood] 删除失败', err);
          wx.showToast({ title: '删除失败，请重试', icon: 'none' });
        }
      }
    });
  },

  // 情绪健康指数（规则推导）：近 7 天分值均值 → 0-100，附解读与昨日对比
  buildHealth(moodLine) {
    const vals = (moodLine || []).map((p) => p.value).filter((v) => typeof v === 'number');
    if (!vals.length) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const score = Math.max(0, Math.min(100, Math.round(((avg - 1) / 4) * 100)));
    const meta =
      score >= 80 ? { emoji: '🌈', label: '很好', note: '最近整体情绪状态很不错，继续保持觉察，记得享受好心情。' }
      : score >= 65 ? { emoji: '🙂', label: '良好', note: '总体平稳，偶有起伏都是正常的，累了就歇一歇。' }
      : score >= 45 ? { emoji: '😐', label: '中等', note: '情绪有些起伏，试着把压力拆小，每天给自己一个小目标。' }
      : score >= 25 ? { emoji: '🌧', label: '偏低', note: '这几天可能消耗比较大，照顾好身体，必要时找信任的人聊聊。' }
      : { emoji: '🌟', label: '需要关注', note: '整体有些低落，你不需要独自扛，求助不可耻——看看「求助」页。' };
    // 与昨日对比（moodLine 最后一位=今天，倒数第二位=昨天）
    const today = moodLine[moodLine.length - 1];
    const yesterday = moodLine[moodLine.length - 2];
    let deltaText = '';
    if (yesterday && typeof today.value === 'number' && typeof yesterday.value === 'number') {
      const d = today.value - yesterday.value;
      deltaText = d > 0.01 ? `  较昨日 +${d.toFixed(1)}` : d < -0.01 ? `  较昨日 ${d.toFixed(1)}` : '  与昨日持平';
    }
    return { score, emoji: meta.emoji, label: meta.label, note: meta.text, deltaText };
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

  // 本周小结（规则生成，突出陪伴感；供周报/分享复用）
  buildWeekSum(list) {
    if (!list || !list.length) return '';
    const stats = this.data.statList || [];
    const top = stats[0];
    const total = list.length;
    const scores = list
      .map((m) => MOOD_SCORE[m.mood])
      .filter((v) => typeof v === 'number' && !isNaN(v));
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const avgTxt = avg == null ? '—' : avg.toFixed(1);
    const topTxt = top ? `最常出现「${top.emoji} ${top.label}」（${top.count} 次，占 ${top.ratio}%）` : '整体情绪偏平稳';
    const tail = avg == null ? '继续保持就好，别对自己太严苛。' : avg >= 4 ? '整体偏轻松，把这份松弛感带给别人也不错。' : avg >= 3 ? '整体偏低落，今天的你已经足够勇敢，允许自己慢一点。' : '整体偏低迷，如果持续难受，请记得「求助」页随时有人可以帮你。';
    return `本周共记录 ${total} 次，${topTxt}；情绪均分 ${avgTxt}/5。${tail}`;
  },
  // 情绪洞察（规则推导，14 天口径）：连低温柔建议、连高点赞、否则整体升降解读
  buildInsight(raw) {
    // 14 天内每天的平均分（当天可能多条记录，取均值）
    const daySum = {};
    (raw || []).forEach((m) => {
      const v = MOOD_SCORE[m.mood];
      if (typeof v !== 'number') return;
      const d = new Date(m.createdAt);
      if (Date.now() - d.getTime() > 14 * 86400000) return;
      const k = d.toDateString();
      if (!daySum[k]) daySum[k] = { s: 0, n: 0 };
      daySum[k].s += v;
      daySum[k].n++;
    });
    const dayAvg = Object.keys(daySum)
      .map((k) => ({ ts: new Date(k).getTime(), v: daySum[k].s / daySum[k].n }))
      .sort((a, b) => a.ts - b.ts);
    if (dayAvg.length < 3) {
      return dayAvg.length ? '多记录几天，我就能看出你情绪的走向啦 🌱' : '';
    }
    // 结尾连续段：从最后一天往前数同档（低 <2.5 / 高 ≥4）天数
    let lowStreak = 0;
    for (let i = dayAvg.length - 1; i >= 0 && dayAvg[i].v < 2.5; i--) lowStreak++;
    let highStreak = 0;
    for (let i = dayAvg.length - 1; i >= 0 && dayAvg[i].v >= 4; i--) highStreak++;
    if (lowStreak >= 3) {
      return `最近连续 ${lowStreak} 天情绪都偏低，辛苦了。可以先做 3 分钟呼吸，或到求助页找我说说，别一个人扛 🌿`;
    }
    if (highStreak >= 3) {
      return `连续 ${highStreak} 天都是明亮的心情，真为你高兴！记得把这份好状态也记下来 🎈`;
    }
    // 整体趋势：前后两半均值对比
    const half = Math.floor(dayAvg.length / 2);
    const a = dayAvg.slice(0, Math.max(1, half)).map((x) => x.v);
    const b = dayAvg.slice(half).map((x) => x.v);
    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
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

  goAssessment() { wx.navigateTo({ url: '/pages/assessment/assessment' }); },

  onShareAppMessage() {
    wx.setStorageSync('ach_share', true); // 成就：分享给朋友
    return {
      title: '我把心情记进了「心语伴」，也欢迎你的心里话 🌱',
      path: '/pages/welcome/welcome?src=share'
    };
  }
});