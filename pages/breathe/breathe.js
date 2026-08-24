// pages/breathe/breathe.js —— 呼吸练习引导（纯本地、无网络）
const app = getApp();

// [阶段名, 时长ms, 目标尺寸(rpx), transition 秒]
// 呼吸节奏预设：默认 4-4-6；盒式 4-4-4-4；长呼 6-2-6-2（长缓缓呼更放松）
const PRESETS = [
  { key: 'calm', label: '放松 · 4-4-6', rounds: [['in', 3800, 460, 3.9], ['hold', 3200, 460, 0.6], ['out', 5600, 150, 5.6]] },
  { key: 'box', label: '盒式 · 4-4-4-4', rounds: [['in', 4000, 520, 4.1], ['hold', 4000, 520, 0.6], ['out', 4000, 150, 4.1], ['hold', 4000, 150, 0.6]] },
  { key: 'long', label: '长呼 · 6-2-6-2', rounds: [['in', 6000, 520, 6.1], ['hold', 2000, 520, 0.6], ['out', 6000, 150, 6.1], ['hold', 2000, 150, 0.6]] },
  { key: 'stare', label: '发呆 · 2 分钟', rounds: [['stare', 120000, 150, 2]] },
  { key: 'mini', label: '课间 · 1.5 分钟', rounds: [['in', 3800, 460, 3.9], ['hold', 3200, 460, 0.6], ['out', 5600, 150, 5.6]] },
  { key: 'wake', label: '晨起 · 3-1-5', rounds: [['in', 3000, 420, 3.1], ['hold', 1000, 420, 0.6], ['out', 5000, 150, 5.1]] },
  { key: 'rush', label: '紧张急救 · 60 秒', rounds: [['in', 4000, 460, 4.1], ['out', 5000, 150, 5.1], ['in', 4000, 460, 4.1], ['out', 5000, 150, 5.1]] }
];
const DAILY_GOAL_MIN = 10; // 每日放松目标：累计 10 分钟（同一次约 5 分钟 → 两次达标）
const CUSTOM_STORE = 'hbBreathCustom'; // 自定义节奏 { in, hold, out } 秒

// 由 吸/屏/呼 秒数 生成 rounds（与内置节奏同构）
function buildCustomRounds(cfg) {
  const i = Math.max(2, Math.min(10, cfg.in || 4));
  const h = Math.max(0, Math.min(10, cfg.hold == null ? 4 : cfg.hold));
  const o = Math.max(2, Math.min(10, cfg.out || 6));
  const ballMax = 150 + Math.round(i * 80);
  const r = [['in', i * 1000, ballMax, i]];
  if (h > 0) r.push(['hold', h * 1000, ballMax, 0.6]);
  r.push(['out', o * 1000, 150, o]);
  return r;
}
function customLabel(cfg) {
  const c = cfg || { in: 4, hold: 4, out: 6 };
  return '自定义 · ' + c.in + '-' + (c.hold || 0) + '-' + c.out;
}

const PH_TEXT = {
  in: '吸气……把空气慢慢填满',
  hold: '屏住呼吸',
  out: '呼气……放松肩膀',
  stare: '安静地待 2 分钟，什么都不用做……',
  done: '完成，做得很好'
};

Page({
  data: {
    phase: 'ready', // ready | in | hold | out | done
    round: 0,
    total: 4,
    ball: 150,
    trans: 0.5,
    text: '准备好了就开始',
    calm: false,
    calmInt: 3,          // 记录「平静」时的强度（1-5，默认 3）
    dayMins: 0,          // 今日呼吸累计分钟
    dayScanMins: 0,      // 今日扫描累计分钟（跨页合并展示）
    dayTotal: 0,         // 今日放松总计 = 呼吸 + 扫描
    dayGoal: DAILY_GOAL_MIN, // 面向 WXML 展示
    echoText: '',          // 完成一次呼吸后的「呼吸回响」
    resumeTip: '',         // 上次练习中断的温柔提示
    weekVs: '',           // 本周 vs 上周练习次数对比
    stareCount: 0,       // 发呆模式累计次数
    bestRun: 0,         // 最长连练天数
    sleepHint: '',      // 深夜完成后的「去睡吧」提示
    heat: [],              // 近 4 周放松热力图
    dayPart: { m: 0, n: 0, e: 0, late: 0 }, // 完成时段分布：早/中/晚/深夜
    timeHint: '',          // 按时段推荐节奏的一句话
    presets: PRESETS.concat([{ key: 'custom', label: '自定义 · 4-4-6', rounds: [] }]),
    presetKey: 'calm',
    intent: '',         // 此刻心意：开始前选的意图词（稳/慢/等/放/无事）；完成态回印
    intentPicked: false, // 已选过（本轮）
    breatheFor: '',    // 这一轮留给谁（对自己/对今天/对一个人）· 完成态回印
    vibeOn: true,        // 节律轻震动（吸/呼交界处柔和提示）
    presetLabel: '放松 · 4-4-6',
    customCfg: { in: 4, hold: 4, out: 6 }
  },

  onLoad() {
    this.setData({ vibeOn: wx.getStorageSync('hb_vibe') !== false });
    // 上次练习中断提示：练习中退出（未完成）会留痕，这次进来温柔提一句
    const brokeAt = wx.getStorageSync('hb_breathBroke');
    if (brokeAt && Date.now() - brokeAt < 86400000) {
      const h = new Date(brokeAt).getHours();
      this.setData({ resumeTip: h >= 22 || h < 6 ? '🌙 昨晚那次呼吸没做完——没关系，睡着也是一种完成。' : '🌱 上次呼吸练到一半就走了，这次想续上吗？' });
    }
    wx.removeStorageSync('hb_breathBroke');
    this._timers = [];
    this._stop = false;
    this._running = false;
    this._rounds = PRESETS[0].rounds;
    try {
      const c = wx.getStorageSync(CUSTOM_STORE);
      if (c && c.in && c.out) {
        this.setData({ customCfg: c, presets: PRESETS.concat([{ key: 'custom', label: customLabel(c), rounds: buildCustomRounds(c) }]) });
        if (this.data.presetKey === 'custom') this.setData({ presetLabel: customLabel(c) });
      }
    } catch (e) {}
  },

  // ---- 每日放松目标：累计分钟数 → 进度条 + 达标庆祝 + 连续天数（纯本地）----
  refreshDayGoal() {
    const today = new Date().toDateString();
    const d = wx.getStorageSync('hb_breatheDay');
    const cur = d && typeof d === 'object' && d.date === today ? d : { mins: 0, done: false };
    // 今日放松总计 = 呼吸分钟 + 身体扫描分钟（扫描页完成也会记入，跨页一致）
    const s = wx.getStorageSync('hb_relaxScan');
    const scanMins = (s && typeof s === 'object' && s.date === today) ? (s.mins || 0) : 0;
    const total = Math.min((cur.mins || 0) + scanMins, DAILY_GOAL_MIN);
    const st = wx.getStorageSync('hb_breatheStreak');
    this.setData({
      dayMins: cur.mins || 0,
      dayScanMins: scanMins,
      dayTotal: total,
      dayPct: Math.min(100, Math.round((total / DAILY_GOAL_MIN) * 100)),
      dayDone: !!cur.done,
      dayStreak: (st && st.n) || 0
    });
  },

  touchDayGoal(addMin) {
    const today = new Date().toDateString();
    let d = wx.getStorageSync('hb_breatheDay');
    if (!d || typeof d !== 'object' || d.date !== today) {
      d = { date: today, mins: 0, done: false };
    }
    d.mins = Math.min((d.mins || 0) + addMin, DAILY_GOAL_MIN);
    d.done = d.mins >= DAILY_GOAL_MIN;
    wx.setStorageSync('hb_breatheDay', d);
    // 连击：达标才推进
    let st = wx.getStorageSync('hb_breatheStreak');
    if (!st || typeof st !== 'object') st = { date: '', n: 0 };
    const y = new Date(Date.now() - 86400000).toDateString();
    if (d.done && st.date !== today) {
      st = { date: today, n: (st.date === y ? st.n : 0) + 1 };
      wx.setStorageSync('hb_breatheStreak', st);
      if (st.n === 1) wx.setStorageSync('ach_breatheDay', true);
      if (st.n === 3 && !wx.getStorageSync('ach_breathe3day')) wx.setStorageSync('ach_breathe3day', true);
      // 连续 7 天达标：给一句有「走了很远」实感的专属庆祝（一次性）
      if (st.n === 7 && !wx.getStorageSync('ach_breathe7day')) {
        wx.setStorageSync('ach_breathe7day', true);
        setTimeout(() => {
          wx.showModal({
            title: '🌿 连续 7 天，好好呼吸',
            content: '一周了。你每天抽出几分钟，让身体放下一点——这比任何「多努力一下」都更照顾自己。',
            showCancel: false,
            confirmText: '我做到了'
          });
        }, 900);
      }
      setTimeout(() => {
        wx.showModal({
          title: '🌸 今日放松目标达成',
          content: `今天累计放松了 ${d.mins} 分钟。已经连续 ${st.n} 天做到了这样一件照顾自己的小事。`,
          showCancel: false,
          confirmText: '夸自己一下'
        });
      }, 350);
    }
    this.refreshDayGoal();
  },

  // 最近 7 次放松记录（breatheWeek 时间戳 → 日期+时刻，纯本地回看）
  buildRecentLog() {
    const ts = wx.getStorageSync('breatheWeek') || [];
    const arr = Array.isArray(ts) ? ts.slice(-7).reverse() : [];
    return arr.map((t) => {
      const d = new Date(t);
      const p = (n) => (n < 10 ? '0' + n : '' + n);
      return { day: `${d.getMonth() + 1}月${d.getDate()}日`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
    });
  },

  // 本周已展示（本地周计数，周一重置）
  // 最长连练：历史上连续有练习的天数最大值（韧性记录）
  buildBestRun(wk) {
    const set = new Set((wk || []).map((t) => new Date(t).toDateString()));
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

  // 本周 vs 上周练习次数：一句对比（周一起算）
  buildWeekVs(wk) {
    const now = new Date();
    const t1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
    const t0 = t1 - 7 * 86400000;
    const cur = (wk || []).filter((t) => t >= t1).length;
    const prev = (wk || []).filter((t) => t >= t0 && t < t1).length;
    if (!prev && !cur) return '';
    if (!prev) return '本周已练 ' + cur + ' 次——上周还是 0，你重新开始了 🌱';
    if (cur > prev) return '本周 ' + cur + ' 次，比上周（' + prev + '）多了 ' + (cur - prev) + ' 次，越来越会照顾自己';
    if (cur < prev) return '本周 ' + cur + ' 次，上周是 ' + prev + ' 次——节奏慢下来也没关系';
    return '本周 ' + cur + ' 次，与上周持平，稳稳的';
  },

  // 完成时段分布：你的放松习惯偏早还是偏晚（本地时间戳统计）
  buildDayPart(wk) {
    const r = { m: 0, n: 0, e: 0, late: 0 };
    (wk || []).forEach((ts) => {
      const h = new Date(ts).getHours();
      if (h < 6) r.late++;
      else if (h < 12) r.m++;
      else if (h < 18) r.n++;
      else r.e++;
    });
    return r;
  },

  // 按时段推荐：早上唤醒用盒式，午间放松 4-4-6，晚上长呼助眠
  timeHint() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return '☀️ 早上刚醒？试试「晨起 3-1-5」：短吸慢呼，把注意力轻轻叫醒';
    if (h >= 22 || h < 5) return '🌙 睡前推荐「长呼 6-2-6-2」，呼气拉长更容易困';
    if (h >= 13 && h < 15) return '😴 午间犯困？「放松 4-4-6」两轮就够';
    return '';
  },

  // 近 4 周放松热力图：28 格，颜色随当天次数加深（周一为第一列）
  buildHeat(wk) {
    const dayCnt = {};
    (wk || []).forEach((ts) => {
      const k = new Date(ts).toDateString();
      dayCnt[k] = (dayCnt[k] || 0) + 1;
    });
    const cells = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const offset = (today.getDay() + 6) % 7; // 今天是本周第几天（周一=0）
    const start = new Date(today.getTime() - offset * 86400000 - 21 * 86400000); // 上上周一
    for (let i = 0; i < 28; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const n = dayCnt[d.toDateString()] || 0;
      cells.push({ d: (d.getMonth() + 1) + '/' + d.getDate(), n, lv: n >= 3 ? 3 : n, future: d > today });
    }
    return cells;
  },

  // 呼吸回响：完成一次后温柔的一句（按完成次数轮换）
  nextEcho() {
    const pool = [
      '山有风，你慢慢吹；心已定，你慢慢来。',
      '吸——呼——这一口气，你赢回来了。',
      '你刚刚做了一件重要的小事：照顾自己。',
      '身体记得「此刻是安全的」，谢谢你的练习。',
      '回到自己身边的感觉，很好。',
      '不用一次做到最好，一次次来就够了。'
    ];
    const n = wx.getStorageSync('breatheCount') || 0;
    if (this.data.presetKey === 'stare') {
      const sp = [
        '这两分钟什么都没做——这正是它的意义。',
        '发呆不是浪费，是大脑在悄悄整理自己。',
        '刚才那段安静，是你的。谁也拿不走。'
      ];
      return sp[n % sp.length];
    }
    return pool[Math.max(0, n - 1) % pool.length];
  },

  weekCount() {
    const now = new Date();
    const wStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const t0 = wStart.getTime();
    const ts = (wx.getStorageSync('breatheWeek') || []);
    return (Array.isArray(ts) ? ts : []).filter((t) => t >= t0).length;
  },

  todayCount() {
    const t0 = new Date().setHours(0, 0, 0, 0);
    const ts = (wx.getStorageSync('breatheWeek') || []);
    return (Array.isArray(ts) ? ts : []).filter((t) => t >= t0).length;
  },

  onShow() {
    this.refreshDayGoal();
    this.setData({ recentLog: this.buildRecentLog() });
    // 累计练习次数展示条（本地计数）
    const count = wx.getStorageSync('breatheCount') || 0;
    const mins = (wx.getStorageSync('hb_breatheMins') || 0);
    const wk = this.weekCount();
    const td = this.todayCount();
    this.setData({ heat: this.buildHeat(wk), dayPart: this.buildDayPart(wk), weekVs: this.buildWeekVs(wk) });
    this.setData({ timeHint: this.data.presetKey === 'stare' ? '🌑 什么都不用做——就发会儿呆，这也是练习' : this.timeHint() });
    this.setData({ stareCount: wx.getStorageSync('hb_stareCount') || 0 });
    this.setData({ bestRun: this.buildBestRun(wx.getStorageSync('breatheWeek') || []) });
    this.setData({ breatheCount: count, breatheMins: mins, breatheWeek: wk, breatheToday: td,
      lastDone: count ? `已累计练习 ${count} 次 · ${mins} 分钟 🌿` : '还没有练习记录，来一次吗？' });
  },

  onUnload() {
    this._stop = true;
    (this._timers || []).forEach((t) => clearTimeout(t));
  },

  // 切换呼吸节奏（未开始时生效；进行中会先结束当前练习）
  setPreset(e) {
    const key = e.currentTarget.dataset.key;
    const isCustom = key === 'custom';
    const p = isCustom
      ? { key: 'custom', label: customLabel(this.data.customCfg), rounds: buildCustomRounds(this.data.customCfg) }
      : PRESETS.find((x) => x.key === key);
    if (!p) return;
    if (this._running) {
      this._stop = true;
      this._running = false;
      this._timers.forEach((t) => clearTimeout(t));
      this._timers = [];
    }
    this._rounds = p.rounds;
    this._rounds = p.rounds;
    this.setData({ presetKey: key, presetLabel: p.label, phase: 'ready', round: 0, ball: 150, trans: 0.5, total: key === 'mini' ? 3 : 4,
      timeHint: key === 'stare' ? '🌑 什么都不用做——就发会儿呆，这也是练习' : this.timeHint(),
      text: '已选「' + p.label + '」，点击开始' + (key === 'stare' ? '安安静静待着' : (key === 'mini' ? '3 轮就好' : '跟着节奏呼吸')), calm: false });
  },

  // 此刻心意：开始前选一个意图词，本轮的心念就朝那个方向轻轻放
  pickIntent(e) {
    const w = e.currentTarget.dataset.w;
    if (!w) return;
    this.setData({ intent: w, intentPicked: true });
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  // 这一轮留给谁：把练习的心意「托付」出去，完成感更稳
  pickFor(e) {
    const w = e.currentTarget.dataset.w;
    if (!w) return;
    this.setData({ breatheFor: w });
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  // 把这一刻说给别人听：复制一段「我刚练完一轮呼吸」的文字给 TA（真诚、不尴尬）
  shareBreath() {
    const mins = this.data.presetKey === 'stare' ? 2 : (this.data.presetKey === 'mini' ? 1 : 4);
    const forWho = this.data.breatheFor || '我自己';
    const d = new Date();
    const lines = [
      '🤲 刚做完一轮呼吸练习，想告诉你',
      '—— 心语伴',
      '',
      `今天练的：${this.data.presetLabel}`,
      `这一轮，我留给了「${forWho}」`,
      `时长约 ${mins} 分钟 · ${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`,
      '',
      '如果它也能帮你放松一点，随时可以试试。'
    ];
    wx.setClipboardData({ data: lines.join('\n'), success: () => wx.showToast({ title: '已复制，可以发给TA了 🤲', icon: 'none' }) });
  },

  // 脸松没松：一次简单觉察。存近 5 次，连续 3 天多数「松」→ 温和确认
  pickFace(e) {
    const w = e.currentTarget.dataset.w;
    const loose = w === '松';
    const log = wx.getStorageSync('hb_faceLog') || [];
    log.push({ w, t: Date.now() });
    wx.setStorageSync('hb_faceLog', log.slice(-10));
    let note = '';
    if (loose) {
      const recent = log.slice(-6).filter((x) => x.t === log[log.length - 1].t);
      const three = log.slice(-6);
      const junk = three.filter((x) => !x.loose && Date.now() - x.t < 3 * 86400000).length;
      note = junk === 0 ? '这两天肩膀和脸都有慢慢放下——身体在回应你的练习 🌿' : '松下来就好，脸和身体都辛苦了 ☁️';
    } else {
      note = '还绷着也没关系——绷着也在呼吸，等会儿再来一轮就好。';
    }
    this.setData({ faceB: loose, faceNote: note });
  },

  startStare() {
    if (this._running) return;
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
    this._running = true;
    this._stop = false;
    this.setData({ round: 1, stare: true, text: '安静地让 2 分钟过去，什么都不用做' });
    this._rounds = [['stare', 120000, 150, 0]];
    this.runRound(1, 0, 1);
  },

  start() {
    if (this.data.presetKey === 'stare') { this.startStare(); return; }
    if (this._running) return;
    wx.setStorageSync('hb_breathBroke', Date.now()); // 进行中标记（完成后清除）
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
    this._running = true;
    this._stop = false;
    this.setData({ round: 1 });
    const tot = this.data.presetKey === 'mini' ? 3 : this.data.total; // 课间档 3 轮 ≈1.5 分钟
    this.runRound(1, 0, tot);
  },

  runRound(r, step, total) {
    if (this._stop) return;
    const rounds = this._rounds || PRESETS[0].rounds;
    const tot = total || this.data.total;
    if (step >= rounds.length) {
      if (r < tot) {
        this.runRound(r + 1, 0, tot);
      } else {
        this._running = false;
        this.setData({ phase: 'done', text: PH_TEXT.done });
        wx.removeStorageSync('hb_breathBroke'); // 完成即清除中断标记
        // 发呆结束：直接给一句专属回响（也算一次放松）
        if (this.data.presetKey === 'stare') {
          this.setData({ echoText: this.nextEcho() });
        // 深夜完成：练完就去睡（22 点后追加一句）
        const hh = new Date().getHours();
        if (hh >= 22 || hh < 5) this.setData({ sleepHint: '练完了就去睡吧——现在的任务只有一个：休息。' });
          const sn = (wx.getStorageSync('hb_stareCount') || 0) + 1;
          wx.setStorageSync('hb_stareCount', sn);
          this.setData({ stareCount: sn });
        }
      }
      return;
    }
    const [phase, ms, ball, trans] = rounds[step];
    this.setData({ round: r, phase, ball, trans, text: PH_TEXT[phase] });
    // 节律轻震动：吸/呼开始时给一个柔和的提示（可关）
    if (this.data.vibeOn && wx.vibrateShort) {
      if (phase === 'in') wx.vibrateShort({ type: 'light' });
      else if (phase === 'out') wx.vibrateShort({ type: 'light' });
      else if (phase === 'hold') wx.vibrateShort({ type: 'heavy' });
    }
    const timer = setTimeout(() => this.runRound(r, step + 1), ms);
    this._timers.push(timer);
  },

  // 节律震动开关：不想要提示就关掉（记忆）
  toggleVibe() {
    const v = !this.data.vibeOn;
    wx.setStorageSync('hb_vibe', v);
    this.setData({ vibeOn: v });
    wx.showToast({ title: v ? '节律震动已开 🔔' : '节律震动已关', icon: 'none' });
  },

  // 结束后把此刻情绪记成「平静」（与心情页/曲线无缝联动）
  // 经典节奏一键填入自定义（4-7-8 助眠 / 4-4-6 放松 / 6-2-6 长呼）
  fillCustom(e) {
    const k = e.currentTarget.dataset.k;
    const presets = {
      relax: { in: 4, hold: 4, out: 6 },
      sleep: { in: 4, hold: 7, out: 8 },
      long:  { in: 6, hold: 2, out: 6 }
    };
    const c = presets[k];
    if (!c) return;
    wx.setStorageSync(CUSTOM_STORE, c);
    const rounds = buildCustomRounds(c);
    const patch = { customCfg: c, presets: PRESETS.concat([{ key: 'custom', label: customLabel(c), rounds }]) };
    if (this.data.presetKey === 'custom' && !this._running) {
      this._rounds = rounds;
      patch.text = '已填入「' + customLabel(c) + '」，点击开始';
    }
    this.setData(patch);
    wx.showToast({ title: '已填入 ' + c.in + '-' + c.hold + '-' + c.out, icon: 'none' });
  },

  // 自定义节奏：吸/屏/呼 秒数加减（2-10 秒，屏气可为 0）
  adjCustom(e) {
    const f = e.currentTarget.dataset.f;
    const d = Number(e.currentTarget.dataset.d);
    const lim = f === 'hold' ? [0, 10] : [2, 10];
    const c = Object.assign({}, this.data.customCfg);
    const v = Math.max(lim[0], Math.min(lim[1], (Number(c[f]) || lim[0]) + d));
    c[f] = v;
    wx.setStorageSync(CUSTOM_STORE, c);
    const rounds = buildCustomRounds(c);
    const patch = { customCfg: c, presets: PRESETS.concat([{ key: 'custom', label: customLabel(c), rounds }]) };
    if (this.data.presetKey === 'custom' && !this._running) {
      this._rounds = rounds;
      patch.text = '已选「' + customLabel(c) + '」，点击开始跟着节奏呼吸';
    }
    this.setData(patch);
  },

  goEdu() { wx.navigateTo({ url: '/pages/edu/edu' }); },

  goScan() {
    wx.navigateTo({ url: '/pages/scan/scan' });
  },

  // 复制这段「呼吸回响」：把此刻的放松也带走一句
  copyEcho() {
    if (!this.data.echoText) return;
    wx.setClipboardData({ data: this.data.echoText, success: () => wx.showToast({ title: '已复制回响', icon: 'success' }) });
  },

  // 结束后的此刻情绪记录（与心情页/曲线无缝联动）
  async recordCalm() {
    if (this.data.calm) return;
    this.setData({ calm: true });
    let openid = app.globalData.openid;
    if (!openid) openid = await app.login();
    if (openid) {
      try {
        const db = wx.cloud.database();
        await db.collection('moods').add({
          data: {
            openid,
            sessionId: 'breath-' + Date.now(),
            mood: 'peace',
            intensity: this.data.calmInt || 3,
            trigger: '呼吸练习',
            createdAt: Date.now()
          }
        });
        if (!wx.getStorageSync('ach_firstRecord')) wx.setStorageSync('ach_firstRecord', true);
        // 呼吸练习徽章：完成 1 次 / 累计 5 次
        const bc = (wx.getStorageSync('breatheCount') || 0) + 1;
        wx.setStorageSync('breatheCount', bc);
        const bm = (wx.getStorageSync('hb_breatheMins') || 0) + 5; // 每次约 5 分钟的平静
        wx.setStorageSync('hb_breatheMins', bm);
        this.setData({ breatheMins: bm });
        // 本周进度（时间戳队列，跨周自动重置）
        const wk = wx.getStorageSync('breatheWeek') || [];
        wk.push(Date.now());
        wx.setStorageSync('breatheWeek', wk);
        this.setData({ breatheWeek: this.weekCount(), breatheToday: this.todayCount() });
        this.setData({ heat: this.buildHeat(wx.getStorageSync('breatheWeek') || []), dayPart: this.buildDayPart(wx.getStorageSync('breatheWeek') || []), weekVs: this.buildWeekVs(wx.getStorageSync('breatheWeek') || []) });
        this.touchDayGoal(5); // 每次约 5 分钟平静 → 累计到今日目标
        if (!wx.getStorageSync('ach_breathe')) wx.setStorageSync('ach_breathe', true);
        if (bc >= 5 && !wx.getStorageSync('ach_breathe5')) wx.setStorageSync('ach_breathe5', true);
        wx.vibrateShort && wx.vibrateShort({ type: 'light' });
        const wkN = this.weekCount();
        wx.showToast({ title: '已记下 · 本周第 ' + wkN + ' 次 · 今日放松 ' + this.data.dayTotal + '/' + DAILY_GOAL_MIN + ' 分钟', icon: 'success' });
        // 今天已达标后再来一次：不催，只确认「你已经在照顾自己」
        if (this.data.dayDone && this.data.dayTotal >= DAILY_GOAL_MIN) {
          setTimeout(() => wx.showToast({ title: '今天目标已达成了，这几次是加给自己的温柔 💚', icon: 'none' }), 800);
        }
        this.setData({ echoText: this.nextEcho() });
        // 深夜完成：练完就去睡（22 点后追加一句）
        const hh = new Date().getHours();
        if (hh >= 22 || hh < 5) this.setData({ sleepHint: '练完了就去睡吧——现在的任务只有一个：休息。' });
      } catch (e) {
        console.error('[breathe] 记录失败', e);
        wx.showToast({ title: '记录失败（可稍后在心情页补记）', icon: 'none' });
      }
    }
  },

  reset() {
    this._stop = true;
    this._running = false;
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
    this.setData({
      phase: 'ready', round: 0, ball: 150, trans: 0.5,
      text: '点击「开始」跟着节奏呼吸', calm: false,
      breatheFor: ''
    });
  },

  // 再来一轮：保持刚才的节奏（含自定义/发呆），直接重新开始
  again() {
    if (this._running) return;
    // 发呆再来一轮：也走同一入口
    this.setData({ phase: 'ready', round: 0, ball: 150, trans: 0.5, calm: false, echoText: '' });
    if (this.data.presetKey === 'stare') { this.startStare(); return; }
    wx.setStorageSync('hb_breathBroke', Date.now());
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
    this._running = true;
    this._stop = false;
    this.setData({ round: 1 });
    this.runRound(1, 0, this.data.total);
  },

  // 记录「平静」前可选强度（1-5）
  setCalmInt(e) {
    const v = Number(e.currentTarget.dataset.v);
    if (v >= 1 && v <= 5) this.setData({ calmInt: v });
  }
});
