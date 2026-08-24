// pages/scan/scan.js —— 5 分钟身体扫描（站内正念，纯本地计时）
const app = getApp();

// 10 段「部位 → 引导语 → 时长(秒)」，合计约 5 分钟
const STAGES = [
  { t: '找个舒服的姿势', d: '坐着或躺着，轻轻闭上眼睛，把注意力先放到腿上。', sec: 30 },
  { t: '感受呼吸', d: '不用刻意调整，就像现在这样，让呼吸自然流动。', sec: 30 },
  { t: '脚底', d: '把注意力放到脚底，感受它和地面、鞋子的接触与温度。', sec: 30 },
  { t: '小腿与大腿', d: '感受小腿的重量、大腿的松弛感，不需要调整，只是「注意到」它在那儿。', sec: 30 },
  { t: '腹部与后背', d: '感受腹部随着呼吸起伏，后背被椅子或床稳稳地托住。', sec: 30 },
  { t: '胸口与肩膀', d: '让呼吸顺畅脉动，肩膀如果还拎着，就顺着呼气松一松。', sec: 30 },
  { t: '手臂', d: '感受双手自然地垂下来，手指轻轻张开，放在舒服的位置。', sec: 30 },
  { t: '头与脸', d: '留意眉心与下颌的紧张，让表情放松下来，下巴轻轻松开。', sec: 30 },
  { t: '整个身体', d: '把注意力放回整个身体——一个完整、正在呼吸、在这里的自己。', sec: 45 },
  { t: '回到当下', d: '慢慢活动手指脚趾，眨眨眼睛，再看一眼周围的安静。', sec: 45 }
];

// 3 分钟「午间快扫」：课间/休息时也能来一轮（更轻，也计入累计完成）
const QUICK_STAGES = [
  { t: '找一个舒服的姿势', d: '坐着或躺着都行，轻轻闭上眼睛，肩膀先松一松。', sec: 40 },
  { t: '跟着呼吸三次', d: '不用刻意调整，跟着呼气把今天绷着的东西放一放。', sec: 40 },
  { t: '扫过大腿 → 胸口 → 肩膀', d: '顺着大腿往上，到胸口，再到肩膀——只是注意到它们，不调整什么。', sec: 60 },
  { t: '回到此刻', d: '动动手指和脚趾，慢慢睁开眼睛，回到眼前这一分钟。', sec: 40 }
];

// 1 分钟「微扫」：等车/排队/课间 60 秒，也能让身体回个神（更轻，计完成）
const MICRO_STAGES = [
  { t: '坐稳，闭眼', d: '只做一件事：深吸一口气，慢慢呼出去。', sec: 30 },
  { t: '扫过肩→心口→腿', d: '像手电筒一样从肩膀照到心口、再落到腿上，只是「看着」它们。', sec: 30 }
];

Page({
  data: {
    stages: STAGES,
    phase: 'ready',   // ready | run | done
    mode: 'full',      // full=5 分钟全身扫描 | quick=3 分钟午间快扫
    modeTotal: STAGES.length,
    feelPicked: '',   // 完成后的身体感受一词
    feelLog: [],     // 最近几次身体感受回看
    timeTip: '',     // 按时段的扫描建议（一句话）
    feelTop: '',     // 身体感受词 Top1
    avgSlot: '',     // 平均完成时段
    scanEcho: '',    // 完成回响：给身体的留言
    scanEchoCnt: 0,  // 累计完成次数（回响灵感）
    doneN: 0,        // 本次是累计第几次
    idx: 0,
    left: 30,
    pct: 0,
    lastDone: '',
    scanStreak: 0,     // 连续扫描天数（最近完成日志往前数）
    scanToday: 0,      // 今天已完成次数
    scanWeek: 0,       // 本周已完成次数
    calmInt: 3        // 完成后「此刻平静程度」（1-5，默认 3，随记录入库）
  },

  onLoad() {
    this._timer = null;
    this._busy = false;
    // 记住上次用的档位（full/quick/micro），下次打开直接用
    const lastMode = wx.getStorageSync('hb_scanMode');
    if (lastMode === 'quick' || lastMode === 'micro') this.setData({ mode: lastMode });
    const ts = wx.getStorageSync('hb_scanDone');
    if (ts) this.setData({ lastDone: `上次完成：${this.fmtDate(ts)}` });
    this.setData({ scanCount: wx.getStorageSync('hb_scanCount') || 0 });
    this.setData({ scanStreak: this.buildScanStreak() });
    this.setData({ scanToday: this.buildScanToday() });
    this.setData({ scanWeek: this.buildScanWeek() });
    this.setData({ opening: this.dayOpening() });
    this.setData({ feelLog: (wx.getStorageSync('hb_scanFeel') || []).slice(-5).reverse() });
    // 感受词 Top1：扫描后身体最常给你的反馈
    const log0 = wx.getStorageSync('hb_scanFeel') || [];
    const cnt = {};
    log0.forEach((x) => { cnt[x.w] = (cnt[x.w] || 0) + 1; });
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    this.setData({ feelTop: (top && cnt[top] >= 3) ? '身体最常的反馈是「' + top + '」（' + cnt[top] + ' 次）——身体在学会放松。' : '' });
    // 平均完成时段：最近完成时刻的众数（扫描记录 hb_scanDone 存的是最后一次，改为队列统计）
    const doneTs = wx.getStorageSync('hb_scanDoneLog') || [];
    if (doneTs.length >= 3) {
      const buckets = { morning: 0, noon: 0, evening: 0, night: 0 };
      doneTs.forEach((t) => {
        const h = new Date(t).getHours();
        if (h < 6) buckets.night++;
        else if (h < 12) buckets.morning++;
        else if (h < 18) buckets.noon++;
        else buckets.evening++;
      });
      const nm = { morning: '早晨', noon: '白天', evening: '晚上', night: '深夜' };
      const bk = Object.keys(buckets).sort((a, b) => buckets[b] - buckets[a])[0];
      this.setData({ avgSlot: '你最常在' + nm[bk] + '完成扫描（' + doneTs.length + ' 次里 ' + buckets[bk] + ' 次）——那个时段最需要安静。' });
    }
    const h = new Date().getHours();
    this.setData({ timeTip: h >= 22 || h < 6 ? '🌙 睡前扫描：躺着做就行，允许自己中途睡着' : h < 11 ? '☀️ 早晨扫描：帮身体先「醒」过来，再开始一天' : h < 18 ? '🌤 白天扫描：课间/午休 5 分钟，给紧绷的地方松绑' : '🌇 傍晚扫描：把今天的压力从身体里扫出去' });
  },

  // 引导语每日轮换：同一天内保持一致，换天换一句
  dayOpening() {
    const POOL = [
      '今天的脑子可能很忙，但身体一直都在这儿等你。',
      '不用做到「很专注」，能陪自己这几分钟就已经很好了。',
      '把此刻当成一次「回到身体」的小旅行。',
      '你不需要赶进度，这里的时间是留给你的。'
    ];
    const d = new Date();
    const idx = (d.getFullYear() * 366 + d.getMonth() * 31 + d.getDate()) % POOL.length;
    return POOL[idx];
  },

  onUnload() { this.stop(); },

  fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  },

  pickMode(e) {
    const m = e.currentTarget.dataset.m;
    this.applyMode(m === 'micro' ? 'micro' : (m === 'quick' ? 'quick' : 'full'));
  },

  // 统一按 mode 取出对应引导段并复位准备态
  applyMode(mode) {
    wx.setStorageSync('hb_scanMode', mode);
    const stages = mode === 'micro' ? MICRO_STAGES : (mode === 'quick' ? QUICK_STAGES : STAGES);
    this.setData({ mode, stages, modeTotal: stages.length, phase: 'ready', idx: 0, left: stages[0].sec, pct: 0 });
  },

  begin(spot) {
    const stages = this.data.mode === 'micro' ? MICRO_STAGES : (this.data.mode === 'quick' ? QUICK_STAGES : STAGES);
    const s = (spot && spot > 0 && this.data.mode === 'full') ? spot : 0;
    this.setData({ phase: 'run', stages, modeTotal: stages.length, idx: s, left: stages[s].sec, pct: Math.round((s / stages.length) * 100) });
    this.startTimer();
  },

  // 先选部位：从你想先照顾的地方开始扫（全身档可用，跳过前面直接到目标部位）
  pickSpot(e) {
    const s = Number(e.currentTarget.dataset.i);
    if (this.data.mode !== 'full') { this.begin(0); return; }
    this.begin(s);
    wx.showToast({ title: s === 8 ? '从头开始扫' : s === 6 ? '从胸口肩膀开始' : '从脚开始', icon: 'none' });
  },

  startTimer() {
    this.stop();
    const self = this;
    this._timer = setInterval(() => {
      const { phase, idx, left } = self.data;
      if (phase !== 'run') return self.stop();
      const stages = self.data.mode === 'micro' ? MICRO_STAGES : (self.data.mode === 'quick' ? QUICK_STAGES : STAGES);
      if (left > 1) {
        self.setData({ left: left - 1, pct: (1 - left / stages[idx].sec) * 100 });
      } else if (idx + 1 < stages.length) {
        const n = idx + 1;
        self.setData({ idx: n, left: stages[n].sec, pct: 0 });
      } else {
        self.onFinish();
      }
    }, 1000);
  },

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  // 身体感受一词：扫完身体，给现在的自己一个描述（本地留最近 5 次）
  pickFeel(e) {
    const w = e.currentTarget.dataset.w;
    // 温柔回执：身体的话被记下来了
    const ACK = { '松了': '松了就好，身体谢谢你 🌿', '暖了': '暖意留住了 🌤', '还有点紧': '还紧着也没关系，已经比刚才好一点', '没什么感觉': '没感觉也是一种答案，不急', '困了': '困了就去睡，晚安 🌙', '轻了': '变轻了！这是身体的反馈', '稳了': '稳稳的，很好', '累了': '累了就早点休息，你辛苦了' };
    if (ACK[w]) wx.showToast({ title: ACK[w], icon: 'none' });
    this.setData({ feelPicked: w });
    const log = wx.getStorageSync('hb_scanFeel') || [];
    log.push({ w, t: Date.now() });
    wx.setStorageSync('hb_scanFeel', log.slice(-20));
    this.setData({ feelLog: log.slice(-5).reverse() });
  },

  goBreathe() { wx.navigateTo({ url: '/pages/breathe/breathe' }); },

  finish() { this.onFinish() },

  async onFinish() {
    this.stop();
    this.setData({ phase: 'done', feelPicked: '', doneN: (wx.getStorageSync('hb_scanCount') || 0) + 1 });
    const ts = Date.now();
    wx.setStorageSync('hb_scanDone', ts);
    const dl = wx.getStorageSync('hb_scanDoneLog') || [];
    dl.push(ts);
    wx.setStorageSync('hb_scanDoneLog', dl.slice(-30));
    this.setData({ lastDone: `上次完成：${this.fmtDate(ts)}`, scanToday: this.buildScanToday(), scanWeek: this.buildScanWeek() });
    // 完成回响：按累计次数与完成时段给一句「身体的留言」（可复制带走）
    this.setData({ scanEcho: this.buildScanEcho(), scanEchoCnt: (wx.getStorageSync('hb_scanCount') || 0) + 1 });
    // 计入今日「放松累计」：扫描/快扫的分钟数也进呼吸页每日 10 分钟目标（跨页一致）
    this.touchRelaxMins(this.data.mode === 'micro' ? 1 : (this.data.mode === 'quick' ? 3 : 5));
    this.setData({ scanStreak: this.buildScanStreak(), scanToday: this.buildScanToday() });
    // 记一次「平静」情绪，进入心情曲线
    try {
      let openid = app.globalData.openid;
      if (!openid) openid = await app.login();
      if (!openid) return;
      await wx.cloud.database().collection('moods').add({
        data: { openid, mood: 'peace', intensity: this.data.calmInt || 3, trigger: '身体扫描', note: this.data.mode === 'micro' ? '1分钟微扫完成' : (this.data.mode === 'quick' ? '3分钟午间快扫完成' : '5分钟身体扫描完成'), createdAt: Date.now() }
      });
      wx.setStorageSync('ach_body_scan', true);
      wx.setStorageSync('ach_scan', true);
      wx.setStorageSync('hb_scanCount', (wx.getStorageSync('hb_scanCount') || 0) + 1);
    } catch (e) {
      console.warn('[scan] 记录心情失败', e);
    }
  },

  exit() {
    if (this.data.phase === 'run') {
      wx.showModal({
        title: '要提前结束吗',
        content: '随时可以下次再来，你的感受最重要。',
        confirmText: '结束',
        cancelText: '继续扫描',
        success: (r) => { if (r.confirm) { this.stop(); wx.navigateBack(); } }
      });
    } else {
      wx.navigateBack();
    }
  },

  // 完成后可选平静程度（1-5，随自动记录入库）
  setCalmInt(e) {
    const v = Number(e.currentTarget.dataset.v);
    if (v >= 1 && v <= 5) this.setData({ calmInt: v });
  },

  again() {
    const stages = this.data.mode === 'micro' ? MICRO_STAGES : (this.data.mode === 'quick' ? QUICK_STAGES : STAGES);
    this.setData({ phase: 'ready', idx: 0, left: stages[0].sec, pct: 0 });
  },

  // 完成回响：给身体的留言（按累计次数轮换 + 顺嘴提时段习惯）
  buildScanEcho() {
    const n = (wx.getStorageSync('hb_scanCount') || 0) + 1;
    const h = new Date().getHours();
    const when = h >= 22 || h < 6 ? '夜深了，身体已经学着放松，你也早点休息。' : h < 11 ? '早晨的安静是给身体的礼物，今天从「顾好自己」开始。' : h < 18 ? '白天挤出的这几分钟，是身体记住的温柔。' : '傍晚把自己扫松了些——晚上会更好睡。';
    const POOL = [
      '刚才从头到脚，你把自己整个「看见」了一遍。这就是照顾。',
      '身体比你想的更信任你——它跟着你完成了一整趟扫描。',
      '你不用「做得完美」，你已经陪自己走了这一整段。',
      '这 5 分钟，你的身体做回了主角，世界安静了一会儿。',
      '每一次扫描，都是你在跟身体说：「我在听你说话」。'
    ];
    const line = POOL[n % POOL.length];
    return when + ' ' + line;
  },

  // 复制这段「扫描回响」带走
  copyScanEcho() {
    if (!this.data.scanEcho) return;
    wx.setClipboardData({ data: this.data.scanEcho, success: () => wx.showToast({ title: '已复制这份身体留言', icon: 'none' }) });
  },

  // 连续扫描天数：从完成时间戳队列往前数（今天或昨天开始都算连续）
  buildScanStreak() {
    const doneTs = wx.getStorageSync('hb_scanDoneLog') || [];
    if (!doneTs.length) return 0;
    const days = Array.from(new Set(doneTs.map((t) => new Date(t).toDateString()))).map(
      (k) => new Date(k + ' 00:00:00').getTime()
    ).sort((a, b) => b - a);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const DAY = 86400000;
    let expect = (today.getTime() === days[0] || today.getTime() - DAY === days[0]) ? days[0] : -1;
    let n = 0;
    for (const d of days) {
      if (expect === -1) break;
      if (d === expect) { n += 1; expect -= DAY; } else break;
    }
    return n;
  },

  // 今日已完成扫描次数（基于当天完成时间戳）
  buildScanToday() {
    const doneTs = wx.getStorageSync('hb_scanDoneLog') || [];
    const t = new Date().toDateString();
    return doneTs.filter((x) => new Date(x).toDateString() === t).length;
  },

  // 本周已完成扫描次数（周一起算）
  buildScanWeek() {
    const doneTs = wx.getStorageSync('hb_scanDoneLog') || [];
    const now = new Date();
    const mon = now.getTime() - ((now.getDay() + 6) % 7) * 86400000;
    const start = new Date(mon).setHours(0, 0, 0, 0);
    return doneTs.filter((x) => new Date(x).getTime() >= start).length;
  },

  // 今日放松累计（跨页共享给呼吸页的每日目标）：按天记录扫描分钟数
  touchRelaxMins(add) {
    const today = new Date().toDateString();
    const r = wx.getStorageSync('hb_relaxScan');
    const rec = (r && typeof r === 'object' && r.date === today) ? r : { date: today, mins: 0 };
    rec.mins = Math.min((rec.mins || 0) + add, 999);
    wx.setStorageSync('hb_relaxScan', rec);
  }
});