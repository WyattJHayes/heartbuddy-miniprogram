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
    trig: [],            // 本次选中的触发来源（多选）
    trigChips: ['作业·考试', '朋友·室友', '家里人', '身体不舒服', '睡不着', '加班·DDL', '天气', '说不出原因'],
    quicking: '',        // 正在提交的 key
    plan: null,          // 3 天陪伴计划（评测页生成，本地共享）
    planIdx: -1,
    planAllDone: false,
    // 时光信：写给 7 天后的自己（本地保存）
    letter: null,        // { content, createdAt }
    letterDue: -1,       // 已过天数（-1 表示还未写信）
    letterReady: false,  // 已到期可拆开
    letterText: '',
    boxCount: 0,           // 已拆开过的时光信数量
    thought: null,         // {{ content, at }} 为 7 天后的回看存下的念头
    thoughtDue: 0,         // 已过去的天数
    thoughtReady: false,   // 7 天到了
    thoughtText: '',
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
    todayTip: false,       // 今日未记录心情时的轻提醒（当天一次可关）
    dayNote: '',           // 今日小结（21 点后的收尾）
    aidPack: null,         // 情绪急救包（记录负性情绪后给即时可做的小事）
    quickInt: 3,           // 快速记录可选强度 1-5（默认 3）
    bandDays: 14,          // 情绪色带天数：14 / 30 可切换
    smallScene: 'body',    // 三件小事灵感场景：study/body/social/me
    dayNoteBanner: false,  // 21 点后还没写小结 → 温柔提示
    yesterdayNote: '',     // 昨天的小结（次日回看）
    nightGreet: '',        // 晚间温柔提醒（21 点后一次性）
    emptyTip: '',          // 连续空白天数提醒（≥3 天，温柔语气）
    moodShift: '',         // 本月最常见情绪转变链
    bestStreak: 0,         // 历史最长连续记录天数
    noteList: [],          // 小结日记本（全部历史小结，倒序）
    noteBookOpen: false    // 日记本展开状态
  },

  onShow() {
    this.fetchMoods();
    this.refreshPlan();
    this.refreshLetter();
    this.refreshThought();
    this.refreshRemind();
    this.refreshSmall();
    this.refreshDayNote();
    this.refreshNightGreeting();
  },

  // ---- 今日小结：21 点后温柔收个尾，第二天早上能回看昨天 ---
  // 晚安条：21 点后进入心情页，顶部一句「今晚早点休息」的温柔提醒（与收尾小结互不打扰）
  refreshNightGreeting() {
    const h = new Date().getHours();
    const night = h >= 21 || h < 5;
    if (!night) return;
    const key = 'hb_nightGreet_' + new Date().toDateString();
    if (wx.getStorageSync(key)) return; // 当天只出现一次
    wx.setStorageSync(key, true);
    this.setData({ nightGreet: h >= 21 ? '🌙 今晚就到这里吧——记录也好，休息也好，你都在好好照顾自己。' : '🌃 这么晚了还醒着，别硬撑，把烦事先交给我。' });
  },

  refreshDayNote() {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const y = new Date(Date.now() - 86400000);
    const ykey = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    const map = wx.getStorageSync('hbDayNote') || {};
    const mine = map[key] || '';
    const ynote = map[ykey] || '';
    // 21 点后、今天还没写小结、且今天记录过心情时才提示（避免打扰）
    const want = !mine && d.getHours() >= 21;
    // 小结日记本：全部按日期倒序（最多 30 条）
    const noteList = Object.keys(map)
      .sort((a, b) => {
        const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
        return (pb[0] - pa[0]) || (pb[1] - pa[1]) || (pb[2] - pa[2]);
      })
      .slice(0, 30)
      .map((k) => ({ date: k, text: map[k] }));
    this.setData({ todayNote: mine, yesterdayNote: ynote, dayNoteBanner: want, noteList });
  },
  onDayNoteInput(e) { this.setData({ dayNoteInput: e.detail.value }); },
  saveDayNote() {
    const text = (this.data.dayNoteInput || '').trim();
    if (!text) { wx.showToast({ title: '写点什么再收尾吧', icon: 'none' }); return; }
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const map = wx.getStorageSync('hbDayNote') || {};
    map[key] = text;
    const keys = Object.keys(map);
    while (keys.length > 40) { delete map[keys.shift()]; }
    wx.setStorageSync('hbDayNote', map);
    this.setData({ todayNote: text, dayNoteBanner: false, dayNoteInput: '' });
    wx.showToast({ title: '今日已收尾 🌙', icon: 'success' });
  },
  // 21 点后的轻提醒：点一下 → 弹出书写
  toggleNoteBook() { this.setData({ noteBookOpen: !this.data.noteBookOpen }); },
  copyNoteItem(e) {
    const t = e.currentTarget.dataset.t;
    if (!t) return;
    wx.setClipboardData({ data: t, success: () => wx.showToast({ title: '已复制这条小结', icon: 'success' }) });
  },

  copyYesterdayNote() {
    const t = this.data.yesterdayNote;
    if (!t) return;
    wx.setClipboardData({ data: '昨天的我写给自己：\n' + t, success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
  },

  openDayNote() {
    wx.showModal({
      title: '给今天收个尾',
      content: '不需要完整，一句话就好：今天你辛苦了，有什么想对自己说的？',
      editable: true,
      placeholderText: '今天……',
      confirmText: '收尾',
      success: (r) => {
        if (!r.confirm) return;
        const text = (r.content || '').trim();
        if (!text) return;
        const d = new Date();
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        const map = wx.getStorageSync('hbDayNote') || {};
        map[key] = text;
        const keys2 = Object.keys(map);
        while (keys2.length > 40) { delete map[keys2.shift()]; }
        wx.setStorageSync('hbDayNote', map);
        this.setData({ todayNote: text, dayNoteBanner: false });
        wx.showToast({ title: '晚安，明天见 🌙', icon: 'success' });
      }
    });
  },

  // ---- 今日三件小事：每天 3 件「为自己做的」，可勾选打卡（本地）----
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

  // 灵感库：不知道写什么时，一键填入一件可做的小事（按场景分组，只填第一个空格）
  fillSmallIdea() {
    const SCENES = {
      study: ['课间趴 3 分钟闭眼休息', '整理错题只做 3 道', '番茄钟 25 分钟后必休息', '把明天要交的作业先列出来'],
      body:  ['晚饭后散步 10 分钟', '睡前把手机放到桌上充电', '喝够 3 杯水', '吃一顿好好咀嚼的午饭', '晚上 10 点半前躺下', '把书桌收拾干净再睡'],
      social:['和同桌说一句玩笑话', '给老朋友发一句「最近好吗」', '放学路上听一首喜欢的歌', '对家人说一句今天的小事'],
      me:    ['给窗台的植物浇浇水', '写 3 行日记再睡', '洗一个长长的热水澡', '对着镜子说一句辛苦了']
    };
    const ideas = SCENES[this.data.smallScene || 'body'] || SCENES.body;
    const items = this.data.smalls.slice();
    const empty = items.findIndex((x) => !x.text);
    if (empty === -1) { wx.showToast({ title: '三件都写好啦', icon: 'none' }); return; }
    const used = new Set(items.map((x) => x.text).filter(Boolean));
    const pool = ideas.filter((i) => !used.has(i));
    items[empty].text = pool[Math.floor(Math.random() * pool.length)] || ideas[0];
    this.setData({ smalls: items });
  },
  setSmallScene(e) {
    this.setData({ smallScene: e.currentTarget.dataset.s });
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

  // ---- 想法小剧场：把一个念头存 7 天，回看时看它小了没（认知解离）----
  refreshThought() {
    const raw = wx.getStorageSync('hbThought');
    if (!raw || !raw.content) { this.setData({ thought: null, thoughtReady: false, thoughtDue: 1 }); return; }
    const due = Math.floor((Date.now() - raw.time) / 86400000);
    this.setData({ thought: raw, thoughtDue: due, thoughtReady: due >= 7 });
  },
  onThoughtInput(e) { this.setData({ thoughtText: e.detail.value }); },
  saveThought() {
    const content = (this.data.thoughtText || '').trim();
    if (!content) { wx.showToast({ title: '先写下那个念头吧', icon: 'none' }); return; }
    wx.setStorageSync('hbThought', { content, time: Date.now() });
    this.setData({ thoughtText: '', thought: { content, time: Date.now() }, thoughtDue: 0, thoughtReady: false });
    wx.showToast({ title: '已存下，7 天后回看', icon: 'success' });
  },
  // 7 天后回看：展示原念头 → 确认回看 → 归档进「想法回看盒」（留最近 10 条）
  thoughtRecall() {
    const t = this.data.thought;
    if (!t) return;
    wx.showModal({
      title: '7 天前你的那个念头',
      content: `当时你写下：「${t.content}」\n\n现在回头看，它还是那么大吗？很多时候，念头只是路过，不是事实。`,
      confirmText: '我回看完了',
      showCancel: true,
      cancelText: '再等等',
      success: (res) => {
        if (!res.confirm) return;
        const box = wx.getStorageSync('hbThoughtBox') || [];
        box.push({ content: t.content, inAt: t.time || 0, seenAt: Date.now() });
        while (box.length > 10) box.shift();
        wx.setStorageSync('hbThoughtBox', box);
        wx.removeStorageSync('hbThought');
        this.setData({ thought: null, thoughtReady: false });
        wx.showToast({ title: '已收入想法盒', icon: 'success' });
      }
    });
  },

  // ---- 时光信：写给 7 天后的自己 ----
  refreshLetter() {
    const box = wx.getStorageSync('hbLetterBox') || [];
    this.setData({ boxCount: Array.isArray(box) ? box.length : 0 });
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
      confirmText: '收到',
      success: () => {
        // 已拆开 → 收进「我的信匣」，随时可回看（保留最近 20 封）
        const box = wx.getStorageSync('hbLetterBox') || [];
        box.push({ content: l.content, at: Date.now() });
        while (box.length > 20) box.shift();
        wx.setStorageSync('hbLetterBox', box);
        this.setData({ boxCount: box.length });
      }
    });
  },

  // 信匣：回看以前拆过的信（最近 3 封，略选其实都在）
  openBox() {
    const box = wx.getStorageSync('hbLetterBox') || [];
    if (!Array.isArray(box) || !box.length) return;
    const recent = box.slice(-3).reverse();
    const lines = recent.map((b) => {
      const d = new Date(b.at);
      return `${d.getMonth() + 1}月${d.getDate()}日 · ${String(b.content || '').slice(0, 24)}…`;
    });
    wx.showActionSheet({
      itemList: lines,
      fail: () => {}
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
  // 触发来源 chips：多选、可反选
  toggleTrig(e) {
    const t = e.currentTarget.dataset.t;
    if (!t) return;
    const arr = (this.data.trig || []).slice();
    const i = arr.indexOf(t);
    if (i >= 0) arr.splice(i, 1); else arr.push(t);
    this.setData({ trig: arr });
  },

  toggleBandDays() {
    const next = (this.data.bandDays === 14) ? 30 : 14;
    this.setData({ bandDays: next, band: this.buildBand(this._raw, next) });
  },

  setQuickInt(e) {
    const v = Number(e.currentTarget.dataset.v);
    if (v >= 1 && v <= 5) this.setData({ quickInt: v });
  },

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
          intensity: this.data.quickInt || 3,
          trigger: this.data.trig && this.data.trig.length ? '快速记录·' + this.data.trig.join('、') : '快速记录',
          createdAt: Date.now()
        }
      });
      wx.vibrateShort && wx.vibrateShort({ type: 'light' });
      if (!wx.getStorageSync('ach_firstRecord')) wx.setStorageSync('ach_firstRecord', true); // 成就：走出第一步
      wx.setStorageSync('hb_lastMoodDate', new Date().toDateString()); // 供 chat 晨间提醒判断
      wx.showToast({ title: meta.label + ' / 已记下', icon: 'success' });
      const _hh = new Date().getHours();
      if (_hh >= 23 || _hh < 6) {
        setTimeout(() => wx.showToast({ title: '夜深了，记完早点休息 🌙', icon: 'none' }), 600);
      }
      this.fetchMoods();
      // 一句随心情的暖心回应（本地文案，保持陪伴感）＋ 情绪急救包
      this.setData({ quickWord: this.randomWord(key), aidPack: this.buildAid(key) });
    } catch (e) {
      console.error('[mood] 快速记录失败', e);
      wx.showToast({ title: '记录失败，请重试', icon: 'none' });
    } finally {
      this.setData({ quicking: '' });
    }
  },

  /* 情绪急救包：记录负性情绪后，给 3 件「现在就能做」的小事（本地） */
  buildAid(key) {
    const AID = {
      angry:  { icon: '🌋', list: ['先离开让你炸毛的现场 30 秒', '喝一口温水，慢慢咽下去', '想骂的话先写在纸上，再撕掉它'] },
      anxious:{ icon: '🌀', list: ['把担心写下来，只挑一件现在能做的', '做 3 次 4-4-6 深呼吸', '起来走 2 分钟，看看窗外'] },
      sad:    { icon: '🌧', list: ['给自己倒杯温水，双手握着它', '允许自己哭一场，不用忍着', '给最信任的人发一句话'] },
      tired:  { icon: '🥱', list: ['把手头的事暂停 10 分钟', '趴下来闭眼 3 分钟', '今晚提前 30 分钟上床'] },
      lonely: { icon: '🕯', list: ['来和心语说说话，我一直在', '翻一个你信任的人的对话框', '出门走 5 分钟，看看路上的人'] }
    };
    const a = AID[key];
    if (!a) return null; // 开心/平静不需要急救包
    return { icon: a.icon, list: a.list };
  },
  closeAidPack() { this.setData({ aidPack: null }); },
  goBreatheNow() { wx.navigateTo({ url: '/pages/breathe/breathe' }); },
  goStationNow() { wx.navigateTo({ url: '/pages/station/station' }); },

  /* 快速记录后的一句暖心回应（本地词库，不落库） */
  randomWord(key) {
    const pool = {
      happy: ['记录这份开心，它也记住了你 🌸', '开心的时刻值得被记住。', '今天有开心的事，真好。'],
      peace: ['平静也是一种力量。', '稳定的你，在慢慢变好。', '这份平静，今天属于你。'],
      tired: ['累了就休息一会儿，我在呢。', '允许自己疲惫，也是一种勇敢。', '好好照顾自己，包括允许累。'],
      angry: ['生气时先呼一口气，我等你说。', '你能记下它，就迈出了第一步。', '情绪来了，不代表真正是你。'],
      sad: ['难过是可以的，我陪你慢慢待着。', '谢谢你愿意把它记下来。', '想哭的话，眼泪也是照顾自己。'],
      anxious: ['担心是正常的，先把它放一放。', '你比自己想的更有力量。', '深呼吸一次，它在慢慢过去。'],
      lonely: ['你并不孤单，我会一直在这。', '有人在认真听你说话。', '孤独会被理解照亮一点。'],
      guilty: ['你已经在尽力了，足够好了。', '对自己温柔一点。', '先心疼自己一会儿。']
    };
    const arr = pool[key] || pool.peace;
    return arr[Math.floor(Math.random() * arr.length)];
  },

  // 记录里程碑：第 10 / 50 / 100 / 200 条，一次性庆祝（本地）
  celebrateMilestone(total) {
    const marks = [10, 50, 100, 200];
    const hit = marks.filter((m) => total >= m).pop();
    if (!hit) return;
    const seen = wx.getStorageSync('hb_milestone') || 0;
    if (seen >= hit) return;
    wx.setStorageSync('hb_milestone', hit);
    const words = { 10: '10 条心情，是你对自己 10 次的诚实。', 50: '50 条了——你一直在认真照顾自己。', 100: '100 条心情！这本情绪日记已经很有分量了。', 200: '200 条记录，你是最了不起的坚持者。' };
    wx.showModal({
      title: '🎉 里程碑',
      content: '你已经记录了 ' + words[hit],
      confirmText: '继续加油',
      showCancel: false
    });
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
      // 情绪断崖预警：今日 vs 昨日均分明显下滑 → 温柔提示（不打扰）
      const lv = moodLine[moodLine.length - 1], pv = moodLine[moodLine.length - 2];
      let cliffTip = '';
      if (lv && lv.value != null && pv && pv.value != null && pv.value - lv.value >= 1.2) {
        cliffTip = `比昨天下滑 ${(pv.value - lv.value).toFixed(1)} 分 · 允许自己慢一点，需要的话我陪你说说`;
      }
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
        likeToday: this.buildLikeToday(raw),
        healthIdx: this.buildHealth(moodLine, raw),
        band: this.buildBand(raw, this.data.bandDays || 14),
        emptyTip: this.buildEmptyTip(raw),
        bestStreak: this.buildBestStreak(raw),
        chartFooter: this.buildChartFooter(moodLine),
        weekSum: this.buildWeekSum(list),
        streak: streakNow,
        cliffTip,
        empty: list.length === 0,
        loaded: true,
        todayTip: this.shouldShowTodayTip(raw)
      });
      this._raw = raw;
      this.celebrateMilestone(list.length);
      this.buildCal(raw);
      this.setData({ monthDays: this.buildMonthDays(raw) });
      this.setData({ trigMonth: this.buildTrigMonth(raw) });
      this.setData({ moodShift: this.buildMoodShift(raw) });
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
    const nowY = now.getFullYear(), nowM = now.getMonth() + 1;
    this.setData({
      calYear: y,
      calMonth: m,
      calCells: cells,
      calTitle: `${y} 年 ${m} 月`,
      calNotMonth: !(y === nowY && m === nowM)
    });
  },

  goChatFromCliff() {
    wx.switchTab({ url: '/pages/chat/chat' });
  },

  calNow() {
    const now = new Date();
    this.setData({ calYear: now.getFullYear(), calMonth: now.getMonth() + 1, calDay: null });
    this.buildCal();
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
    if (!cell || !cell.count) {
      // 无记录的那天：允许补记一条心情（回填到当天中午，明确标注「日历补记」）
      wx.showModal({
        title: '这天还没有记录',
        content: '可以补记一条当天的心情（会算进那天的曲线）。也可以留空只补时间点。',
        editable: true,
        placeholderText: '那天发生了什么？（可不填）',
        confirmText: '补记',
        cancelText: '算了',
        success: async (r) => {
          if (!r.confirm) return;
          const note = (r.content || '').trim();
          const parts = String(k).split('-').map((x) => Number(x));
          if (parts.length !== 3 || !parts[2]) { wx.showToast({ title: '日期不对，请重试', icon: 'none' }); return; }
          wx.showLoading({ title: '补记中…' });
          try {
            let openid = app.globalData.openid;
            if (!openid) openid = await app.login();
            if (!openid) return;
            const t = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0).getTime();
            await wx.cloud.database().collection('moods').add({
              data: {
                openid,
                sessionId: 'cal-back-' + k + '-' + Date.now(),
                mood: 'peace',
                intensity: 3,
                trigger: '日历补记',
                note: note || '（补记当天）',
                createdAt: t
              }
            });
            wx.hideLoading();
            wx.showToast({ title: '已补记，曲线已更新', icon: 'success' });
            this.fetchMoods();
          } catch (err) {
            wx.hideLoading();
            console.error('[mood] 补记失败', err);
            wx.showToast({ title: '补记失败，请重试', icon: 'none' });
          }
        }
      });
      return;
    }
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

  // 日历月报：把当月记录概况复制成一段文字（给老师/家长/自己看）
  copyCalMonth() {
    const y = this.data.calYear, mo = this.data.calMonth;
    const days = this.data.monthDays || 0;
    if (!days) { wx.showToast({ title: '本月还没有记录', icon: 'none' }); return; }
    const raw = this._raw || [];
    const cnt = {};
    raw.forEach((m) => {
      const d = new Date(m.createdAt);
      if (d.getFullYear() === y && d.getMonth() + 1 === mo) cnt[m.mood] = (cnt[m.mood] || 0) + 1;
    });
    const total = Object.keys(cnt).reduce((a, k) => a + cnt[k], 0);
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 3)
      .map((k) => (MOOD_META[k] ? MOOD_META[k].label : k) + '×' + cnt[k]).join('、');
    // 本月写过的小结篇数（本地小结日记本）
    const noteMap = wx.getStorageSync('hbDayNote') || {};
    const noteN = Object.keys(noteMap).filter((k) => {
      const p = k.split('-').map(Number);
      return p[0] === y && p[1] === mo;
    }).length;
    const txt = [
      '【' + y + ' 年 ' + mo + ' 月 心情月报 · 心语伴】',
      '· 记录 ' + total + ' 条心情，覆盖 ' + days + ' 天',
      '· 出现最多：' + (top || '—'),
      noteN ? '· 晚间小结 ' + noteN + ' 篇' : '',
      '· 情绪有起有落都是正常的，记录本身就是在照顾自己。'
    ].filter(Boolean).join('\n');
    wx.setClipboardData({ data: txt, success: () => wx.showToast({ title: '已复制月报', icon: 'success' }) });
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
  // 最像此刻的一天：近 30 天内，与今天最近一次记录心情最像的那天（按情绪分值最接近 + 次数加权）
  buildLikeToday(raw) {
    if (!raw || !raw.length) return null;
    const SC = MOOD_SCORE || { happy: 5, peace: 4, angry: 3, anxiety: 2, lonely: 1.5, sad: 1 };
    const sorted = raw.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const latest = sorted[0];
    if (!latest || !latest.mood) return null;
    const cur = MOOD_META[latest.mood];
    const curScore = SC[latest.mood] || 3;
    // 按天聚合：主导心情
    const byDay = {};
    sorted.forEach((m) => {
      const d = new Date(m.createdAt);
      const key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      const md = d.getMonth() + 1 + '月' + d.getDate() + '日';
      if (!byDay[key]) byDay[key] = { date: md, moods: {}, notes: [] };
      const g = byDay[key];
      g.moods[m.mood] = (g.moods[m.mood] || 0) + 1;
      if ((m.trigger || '').indexOf('补记') >= 0 && m.remark) g.notes.push(m.remark);
    });
    let best = null, bestDiff = Infinity;
    Object.keys(byDay).forEach((k) => {
      const g = byDay[k];
      let dom = null, max = 0;
      Object.keys(g.moods).forEach((mk) => {
        if (g.moods[mk] > max) { max = g.moods[mk]; dom = mk; }
      });
      if (!dom) return;
      // 与今天的分数差异 + 若心情相同给一点惩罚，避免贴“同一天”粘着今天
      const diff = Math.abs((SC[dom] || 3) - curScore) + (dom === latest.mood ? 0.4 : 0);
      if (diff < bestDiff) { bestDiff = diff; best = { k, g, dom }; }
    });
    if (!best || bestDiff === Infinity) return null;
    const meta = MOOD_SCORE[best.dom] && MOOD_META[best.dom] ? MOOD_META[best.dom] : null;
    return {
      label: meta ? meta.label : best.dom,
      emoji: meta ? meta.emoji : '🌱',
      date: best.g.key,
      note: best.g.notes[best.g.notes.length - 1] || ''
    };
  },

  // 本月触发来源排行（trigger 频率 Top4，读懂「最近一个月情绪从哪里来」）
  buildTrigMonth(raw) {
    const now = new Date();
    const y = now.getFullYear(), mo = now.getMonth();
    const cnt = {};
    (raw || []).forEach((r) => {
      const d = new Date(r.createdAt);
      if (d.getFullYear() === y && d.getMonth() === mo) {
        const k = r.trigger || '其他';
        cnt[k] = (cnt[k] || 0) + 1;
      }
    });
    return Object.keys(cnt)
      .map((k) => ({ k, c: cnt[k] }))
      .sort((a, b) => b.c - a.c)
      .slice(0, 4);
  },

  // 本月已记录的天数（去重）
  // 本月情绪转换：同一天内「从 A 变到 B」最常出现的链（如 焦虑→平静）
  buildMoodShift(raw) {
    const now = new Date();
    const y = now.getFullYear(), mo = now.getMonth();
    const byDay = {};
    (raw || []).forEach((m) => {
      const d = new Date(m.createdAt);
      if (d.getFullYear() !== y || d.getMonth() !== mo) return;
      const k = d.toDateString();
      (byDay[k] = byDay[k] || []).push({ t: m.createdAt, mood: m.mood });
    });
    const cnt = {};
    Object.keys(byDay).forEach((k) => {
      const arr = byDay[k].sort((a, b) => a.t - b.t);
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].mood === arr[i - 1].mood) continue;
        const key = arr[i - 1].mood + '→' + arr[i].mood;
        cnt[key] = (cnt[key] || 0) + 1;
      }
    });
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    if (!top || cnt[top] < 2) return '';
    const [a, b] = top.split('→');
    const L = (k) => (MOOD_META[k] ? MOOD_META[k].label : k);
    return '本月你最常经历的转变是「' + L(a) + ' → ' + L(b) + '」（' + cnt[top] + ' 次）——情绪会流动，它不会停在一个地方。';
  },

  buildMonthDays(raw) {
    const now = new Date();
    const y = now.getFullYear(), mo = now.getMonth();
    const set = new Set();
    (raw || []).forEach((m) => {
      const d = new Date(m.createdAt);
      if (d.getFullYear() === y && d.getMonth() === mo) set.add(d.getDate());
    });
    return set.size;
  },

  // 最长连续记录：历史最高连击天数（🏆 展示在色带标题旁）
  buildBestStreak(raw) {
    const set = new Set((raw || []).map((m) => new Date(m.createdAt).toDateString()));
    if (!set.size) return 0;
    const days = Array.from(set).map((k) => new Date(k + ' 00:00:00').getTime()).sort((a, b) => a - b);
    let best = 1, cur = 1;
    const DAY = 86400000;
    for (let i = 1; i < days.length; i++) {
      if (days[i] - days[i - 1] === DAY) { cur++; if (cur > best) best = cur; }
      else cur = 1;
    }
    return best;
  },

  // 连续空白提醒：最近 3 天及以上没有记录时，温柔提示（不评判，只是提醒）
  copyWeekSum() {
    const t = this.data.weekSum;
    if (!t) return;
    wx.setClipboardData({ data: '【本周小结 · 心语伴】\n' + t, success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
  },

  buildEmptyTip(raw) {
    const DAY = 86400000;
    const set = new Set((raw || []).map((m) => new Date(m.createdAt).toDateString()));
    let gap = 0;
    for (let i = 1; i <= 7; i++) { // 从昨天往前数（今天没记不算 gap）
      if (set.has(new Date(Date.now() - i * DAY).toDateString())) break;
      gap++;
    }
    if (gap < 3) return '';
    return '🌱 有 ' + gap + ' 天没见到你了。不是催你——想说话的时候，我随时在。';
  },

  buildBand(raw, days) {
    const N = days || 14;
    const dayMap = {};
    (raw || []).forEach((m) => {
      const k = new Date(m.createdAt).toDateString();
      if (!(k in dayMap)) {
        const meta = MOOD_META[m.mood];
        dayMap[k] = meta ? meta.emoji : '·';
      }
    });
    const band = [];
    for (let i = N - 1; i >= 0; i--) {
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
  // 本周 vs 上周均值变化（只对比有记录的天）
  buildWeekDelta(raw) {
    const DAY = 86400000;
    const now = Date.now();
    const avg = (arr) => {
      const v = arr.map((m) => MOOD_SCORE[m.mood]).filter((x) => typeof x === 'number');
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const cur = avg((raw || []).filter((m) => m.createdAt > now - 7 * DAY));
    const prev = avg((raw || []).filter((m) => m.createdAt > now - 14 * DAY && m.createdAt <= now - 7 * DAY));
    if (cur == null || prev == null) return '';
    const d = +(cur - prev).toFixed(1);
    if (d > 0.05) return '较上周 ↑' + d;
    if (d < -0.05) return '较上周 ↓' + Math.abs(d);
    return '与上周持平';
  },

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
    return { score, emoji: meta.emoji, label: meta.label, note: meta.note, deltaText, weekDelta: raw ? this.buildWeekDelta(raw) : '' };
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
    // 一句状态解读：最近记录里出现最多的心情是什么（陪伴感的总结）
    let stateTip = '';
    if (statList.length) {
      const top = statList[0];
      const dayN = new Set(list.map((m) => new Date(m.createdAt).toDateString())).size;
      stateTip = dayN > 0
        ? `${top.label}出现了 ${top.count} 次，占这 ${dayN} 天记录的 ${top.ratio}%。它来过，也被你看见过。`
        : '';
    }
    this.setData({ statList, stateTip });
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