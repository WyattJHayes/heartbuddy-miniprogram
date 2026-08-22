// pages/profile/profile.js —— 我的
const app = getApp();
const api = require('../../utils/api');
const planlib = require('../../utils/plan');
const { dailyQuotes } = require('../../config/index');
const { calcStreak } = require('../../utils/streak');

Page({
  data: {
    openid: '',
    shortId: '',
    chatTotal: 0,
    assessTotal: 0,
    crisisTotal: 0,
    feedback: '',
    submitting: false,
    badges: [],
    gotCount: 0,
    badgeTotal: 0,
    // 数据足迹
    firstDate: '',     // 最早一条记录
    streakDays: 0,     // 当前连续打卡天数（本地估算）
    mood7: [],         // 近 7 天是否记录（true/false × 7，最左是最老）
    footprintSum: 0,
    // 我的珍藏（聊天长按珍藏，本地保存）
    favs: [],
    eduDone: 0,          // 心理小课已学节数
    nextBadge: null,     // 下一枚待解锁徽章
    yearStat: null,      // 年度统计（今年记录条数/天数）
    eduTotal: 7,
    showFavs: false,
    favCount: 0,
    // 日签问候
    greetEmoji: '🌤',
    greetText: ''
  },

  onShow() {
    this.setGreet();
    this.loadPlanInfo();
    this.loadStats();
    this.refreshBadges();
    this.setData({ eduDone: (wx.getStorageSync('hb_eduDone') || []).length });
    this.calcYearStat();
    this.setData({ accompanyMilestoneText: this.accompanyMilestone(this.data.accompanyDays || 0) });
    this.refreshFavs();
  },

  // 陪伴天数里程碑：7/30/100/365 天给一句专属文案
  accompanyMilestone(days) {
    if (!days) return '';
    if (days >= 365) return '一年了。谢谢你把这一年的心事，也分了我一份。';
    if (days >= 100) return '100 天了——你是最长情的照顾自己的人。';
    if (days >= 30) return '满一个月啦。习惯不是坚持出来的，是温柔地重复出来的。';
    if (days >= 7) return '一周了，你已经证明了「我可以一直陪自己」。';
    return '';
  },

  // 按时段的轻问候（每 2 小时换一次文案）
  setGreet() {
    const h = new Date().getHours();
    const sale = [
      ['🌤', '早上好。今天也从照顾自己开始。'],
      ['☀️', '午安，记得留一点时间给自己。'],
      ['🌇', '傍晚了，把今天放下一点点。'],
      ['🌙', '晚上好，慢慢来，睡觉也是照顾自己。']
    ];
    const p = h < 6 ? 3 : h < 11 ? 0 : h < 14 ? 1 : h < 18 ? 2 : 3;
    const cur = sale[p];
    if (this.data.greetText !== cur[1]) this.setData({ greetEmoji: cur[0], greetText: cur[1] });
  },

  // 陪伴计划进度：今天第几天、今天任务是什么
  loadPlanInfo() {
    const plan = planlib.load();
    let planInfo = null;
    if (plan) {
      const pi = planlib.activeIndex(plan);
      if (pi >= 0 && pi < plan.days.length) {
        planInfo = { cur: pi + 1, total: plan.days.length, title: plan.days[pi].title, done: !!(plan.done && plan.done[pi]) };
      }
    }
    this.setData({ planInfo });
  },

  goPlan() { wx.navigateTo({ url: '/pages/assessment/assessment' }); },

  // ---- 我的珍藏（聊天页长按珍藏，本地）----
  refreshFavs() {
    const favs = wx.getStorageSync('hb_favs') || [];
    this.setData({ favCount: favs.length });
  },

  openFavs() {
    const favs = wx.getStorageSync('hb_favs') || [];
    this.setData({ showFavs: true, favs });
  },

  closeFavs() { this.setData({ showFavs: false }); },

  // 一键复制全部珍藏（整理成一段可归档的文字）
  copyAllFavs() {
    const favs = this.data.favs || [];
    if (!favs.length) {
      wx.showToast({ title: '还没有珍藏的内容', icon: 'none' });
      return;
    }
    const head = '【心语伴 · 我的珍藏】' + favs.length + ' 条\n\n';
    const body = favs.map((f, i) => `${i + 1}. ${f.text}`).join('\n');
    wx.setClipboardData({
      data: head + body,
      success: () => wx.showToast({ title: '已复制全部珍藏', icon: 'success' })
    });
  },

  noop() {},

  copyFav(e) {
    const t = e.currentTarget.dataset.text;
    if (!t) return;
    wx.setClipboardData({ data: t, success: () => wx.showToast({ title: '已复制', icon: 'none' }) });
  },

  // 长按单条珍藏 → 确认后删除
  delFav(e) {
    const i = Number(e.currentTarget.dataset.i);
    const favs = this.data.favs || [];
    if (!(i >= 0) || !favs[i]) return;
    const snippet = favs[i].text.length > 12 ? favs[i].text.slice(0, 12) + '…' : favs[i].text;
    wx.showModal({
      title: '删除这条珍藏？',
      content: `「${snippet}」`,
      confirmText: '删除',
      cancelText: '留下',
      success: (r) => {
        if (!r.confirm) return;
        const next = favs.slice();
        next.splice(i, 1);
        wx.setStorageSync('hb_favs', next);
        this.setData({ favs: next, favCount: next.length });
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },

  clearFavs() {
    wx.showModal({
      title: '清空我的珍藏？',
      content: '本地珍藏将全部删除，不可恢复。',
      confirmText: '清空',
      success: (r) => {
        if (!r.confirm) return;
        wx.removeStorageSync('hb_favs');
        this.setData({ showFavs: false, favs: [], favCount: 0 });
        wx.showToast({ title: '已清空', icon: 'none' });
      }
    });
  },

  // 成就徽章（本地记录解锁情况）
  refreshBadges() {
    const defs = [
      { key: 'ach_firstRecord', emoji: '🌱', title: '走出第一步', desc: '记录第一条心情' },
      { key: 'ach_streak3', emoji: '🔥', title: '坚持 3 天', desc: '连续打卡 3 天' },
      { key: 'ach_streak7', emoji: '🌿', title: '坚持 7 天', desc: '连续打卡 7 天' },
      { key: 'ach_breathe',     emoji: '🍃', title: '一呼一吸', desc: '完成一次呼吸练习' },
      { key: 'ach_breathe5',    emoji: '🧘', title: '呼吸行者', desc: '呼吸练习累计 5 次' },
      { key: 'ach_assess',      emoji: '📋', title: '认识自己', desc: '完成一次自评' },
      { key: 'ach_letter',      emoji: '💌', title: '写给未来', desc: '寄出时光信' },
      { key: 'ach_care',        emoji: '💛', title: '也请心语来看我', desc: '安排一次 24h 回访' },
      { key: 'ach_fav',         emoji: '📌', title: '念念不忘', desc: '珍藏一句话' },
      { key: 'ach_scan',        emoji: '🧭', title: '安放自己', desc: '完成 1 次身体扫描' },
      { key: 'ach_scan3',       emoji: '🌌', title: '内在旅行者', desc: '身体扫描累计 3 次' },
      { key: 'ach_small3',      emoji: '💫', title: '微小而确定', desc: '一天之内做完 3 件小事' },
      { key: 'ach_share',       emoji: '🤝', title: '陪伴他人', desc: '把心语伴分享出去' },
      { key: 'ach_edu',        emoji: '🎓', title: '小学霸', desc: '学完心理小课全部 7 节' },
      { key: 'ach_askOut',     emoji: '📣', title: '开口一次', desc: '复制求助话术发给信任的人' },
      { key: 'ach_edu7',       emoji: '🔥', title: '连学 7 天', desc: '心理小课连续学习一周' }
    ];
    const scanCount = wx.getStorageSync('hb_scanCount') || 0;
    const eduDone = (wx.getStorageSync('hb_eduDone') || []).length >= 7;
    if (eduDone) wx.setStorageSync('ach_edu', true);
    if (calcStreak(wx.getStorageSync('hb_eduDays') || []) >= 7) wx.setStorageSync('ach_edu7', true);
    const badgeDates = wx.getStorageSync('hb_badgeDates') || {};
    const badges = defs.map((b) => {
      let got = !!wx.getStorageSync(b.key);
      if (b.key === 'ach_scan' && got) got = true;
      if (b.key === 'ach_scan3' && scanCount >= 3) got = true;
      // 点亮日期：第一次见到它已解锁时记下（本地，用于展示）
      let gotDate = badgeDates[b.key] || '';
      if (got && !gotDate) {
        const d = new Date();
        gotDate = (d.getMonth() + 1) + '/' + d.getDate();
        badgeDates[b.key] = gotDate;
      }
      return { ...b, got, gotDate };
    });
    wx.setStorageSync('hb_badgeDates', badgeDates);
    badges.sort((a, b) => (b.got ? 1 : 0) - (a.got ? 1 : 0)); // 已点亮排前面，一眼看到成绩
    const gotCount = badges.filter((b) => b.got).length;
    // 下一枚徽章提示（最靠前的未解锁项，答辩/日常都更有目标感）
    const next = badges.find((b) => !b.got) || null;
    this.setData({ badges, gotCount, badgeTotal: badges.length, nextBadge: next });
  },

  async loadStats() {
    let openid = app.globalData.openid;
    if (!openid) openid = await app.login();
    this.setData({ openid: openid || '', shortId: openid ? openid.slice(-6) : '' });
    if (!openid) return;

    try {
      const db = wx.cloud.database();
      const [moods, assessments, crisis, firstRec] = await Promise.all([
        db.collection('moods').where({ openid }).count(),
        db.collection('assessments').where({ openid }).count().catch(() => ({ total: 0 })),
        db.collection('crisisAlerts').where({ openid }).count().catch(() => ({ total: 0 })),
        db.collection('moods').where({ openid }).orderBy('createdAt', 'asc').limit(1).get().catch(() => ({ data: [] }))
      ]);
      // 连续打卡：取最近 30 条，从今天往回数
      const recent = await db.collection('moods').where({ openid }).orderBy('createdAt', 'desc').limit(30).get().catch(() => ({ data: [] }));
      const daySet = new Set((recent.data || []).map((m) => new Date(m.createdAt).toDateString()));
      const DAY = 24 * 3600 * 1000;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      // 距离上次有记录的天数（用于「好久不见」温柔回卡）
      const lastR = recent.data && recent.data[0];
      let missDays = 0;
      if (lastR) {
        const d0 = new Date(lastR.createdAt); d0.setHours(0, 0, 0, 0);
        missDays = Math.floor((today.getTime() - d0.getTime()) / DAY);
      }
      if (!daySet.has(today.toDateString())) {
        const y = new Date(today.getTime() - DAY);
        if (!daySet.has(y.toDateString())) { /* streak 0 */ }
      }
      let streakDays = 0;
      const cursor = daySet.has(today.toDateString()) ? today : new Date(today.getTime() - DAY);
      while (daySet.has(cursor.toDateString())) {
        streakDays += 1;
        cursor.setTime(cursor.getTime() - DAY);
        if (streakDays > 365) break;
      }
      // 近 7 天记录足迹（最老 → 最新）
      const mood7 = [];
      const wkLabels = ['日', '一', '二', '三', '四', '五', '六'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * DAY);
        mood7.push(daySet.has(d.toDateString()) ? 1 : 0);
      }
      // 星期标签：与 7 格一一对应（最后一格是今天）
      const wk = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * DAY);
        wk.push(i === 0 ? '今' : wkLabels[d.getDay()]);
      }
      // 本月平均强度 + 最常用记录入口（trigger 统计，脱敏展示）
      const mStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
      const _ = db.command;
      const monthRes = await db.collection('moods')
        .where({ openid, createdAt: _.gte(mStart) }).orderBy('createdAt', 'desc').limit(200)
        .get().catch(() => ({ data: [] }));
      const mList = monthRes.data || [];
      let monthAvgInt = '';
      const ints = mList.map((m) => m.intensity).filter((v) => typeof v === 'number' && v > 0);
      if (ints.length) {
        monthAvgInt = (ints.reduce((a, b) => a + b, 0) / ints.length).toFixed(1);
      }
      const trig = {};
      mList.forEach((m) => {
        const t = (m.trigger || '').trim();
        if (t) trig[t] = (trig[t] || 0) + 1;
      });
      const topTrig = Object.keys(trig).sort((a, b) => trig[b] - trig[a])[0] || '';
      // 本月练习痕迹：呼吸 / 身体扫描 / 写给自己
      const pBreath = mList.filter((m) => (m.trigger || '').indexOf('呼吸') >= 0).length;
      const pScan = mList.filter((m) => (m.trigger || '').indexOf('扫描') >= 0).length;
      const pWrite = mList.filter((m) => (m.trigger || '').indexOf('写给自己') >= 0 || (m.trigger || '').indexOf('慢') >= 0).length;
      const first = firstRec.data && firstRec.data[0];
      let accompanyDays = 0;
      if (first) accompanyDays = Math.max(1, Math.floor((Date.now() - first.createdAt) / 86400000) + 1);
      this.setData({
        chatTotal: moods.total || 0,
        assessTotal: assessments.total || 0,
        crisisTotal: crisis.total || 0,
        firstDate: first ? this.fmtDate(first.createdAt) : '—',
        accompanyDays,
        // 最近一次自评（本地缓存：完成即写，这里直接读）
        lastAssess: wx.getStorageSync('lastAssessment') || null,
        lastAssessDate: wx.getStorageSync('lastAssessment') ? this.fmtDate(wx.getStorageSync('lastAssessment').ts || Date.now()) : '',
        pBreath, pScan, pWrite,
        streakDays,
        mood7Days: mood7,
        wkLabels: wk,
        monthAvgInt,
        topTrig,
        footprintSum: (moods.total || 0) + (assessments.total || 0) + (crisis.total || 0),
        missDays
      });
    } catch (e) {
      console.error('[profile] 统计失败', e);
    }
  },

  goMoodBack() {
    wx.switchTab({ url: '/pages/mood/mood' });
  },

  goAssess() {
    wx.navigateTo({ url: '/pages/assessment/assessment' });
  },

  fmtDate(ts) {
    const d = new Date(ts);
    const p = (n) => (n < 10 ? '0' + n : n);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  // 数据透明说明：告诉用户每一类数据存放在哪里、用来做什么（安全与知情同意）
  // 今日心情卡：Canvas 绘制 → 保存成图（可发朋友圈/分享给家长老师）
  async drawShareCard() {
    if (this._cardBusy) return;
    this._cardBusy = true;
    try {
      const q = this.createSelectorQuery();
      const res = await new Promise((resolve) => {
        q.select('#shareCard').fields({ node: true, size: true }).exec((r) => resolve(r && r[0] && r[0].node ? r[0] : null));
      });
      if (!res) { wx.showToast({ title: '卡片就绪中，再试一次', icon: 'none' }); return; }
      const canvas = res.node;
      const ctx = canvas.getContext('2d');
      canvas.width = 300 * 2; canvas.height = 220 * 2;
      ctx.scale(2, 2);
      // 背景
      ctx.fillStyle = '#fffaf2'; ctx.fillRect(0, 0, 300, 220);
      ctx.fillStyle = '#f3e9d8'; ctx.fillRect(0, 0, 300, 8);
      // 标题
      ctx.fillStyle = '#8f6b1f'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('心语伴 · 今日一句', 150, 32);
      // 日期
      const d = new Date();
      ctx.fillStyle = '#a3adc4'; ctx.font = '11px sans-serif';
      ctx.fillText(`${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`, 150, 52);
      // 中间的话（长句自动两行）
      ctx.fillStyle = '#4a5568'; ctx.font = '16px sans-serif';
      const quote = dailyQuotes[(d.getDate() + d.getMonth()) % dailyQuotes.length];
      let words = quote, lines = [];
      const maxW = 260;
      while (words.length) {
        let i = words.length;
        while (i > 0 && ctx.measureText(words.slice(0, i)).width > maxW) i--;
        if (i <= 0) i = 1;
        lines.push(words.slice(0, i)); words = words.slice(i);
      }
      lines.slice(0, 3).forEach((ln, idx) => ctx.fillText(ln, 150, 92 + idx * 24));
      // 数据行
      ctx.fillStyle = '#8b9ac0'; ctx.font = '11px sans-serif';
      ctx.fillText(`已陪你 ${this.data.streakDays || 0} 天 · 写过 ${this.data.footprintSum || 0} 次心情`, 150, 168);
      ctx.fillStyle = '#b8c2da';
      ctx.fillText('—— 心语伴：你的情绪守护小伙伴', 150, 196);
      // 存图
      const tmp = await new Promise((resolve) => {
        wx.canvasToTempFilePath({ canvas, success: resolve, fail: () => resolve(null) }, this);
      });
      this._cardBusy = false;
      if (!tmp || !tmp.tempFilePath) { wx.showToast({ title: '生成失败，请重试', icon: 'none' }); return; }
      await this.saveToAlbum(tmp.tempFilePath);
    } catch (e) { console.error('[profile] 分享卡失败', e); this._cardBusy = false; }
  },
  saveToAlbum(path) {
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => wx.showToast({ title: '已保存 · 可以分享啦', icon: 'success' }),
      fail: () => wx.showModal({ title: '保存到相册', content: '需要你允许保存图片到相册，就能把这张卡发给别人。', confirmText: '去设置', success: (r) => r.confirm && wx.openSetting() })
    });
  },

  // 年度统计：今年记录了多少条、覆盖多少天（数据足迹的年度一栏）
  async calcYearStat() {
    try {
      let openid = app.globalData.openid;
      if (!openid) openid = await app.login();
      if (!openid) return;
      const y = new Date().getFullYear();
      const start = new Date(y, 0, 1).getTime();
      const db = wx.cloud.database();
      const r = await db.collection('moods')
        .where({ openid, createdAt: db.command.gte(start) })
        .limit(100).get();
      const list = r.data || [];
      const days = new Set(list.map((m) => new Date(m.createdAt).toDateString())).size;
      this.setData({ yearStat: { n: list.length, days, y } });
    } catch (e) { /* 静默 */ }
  },

  goEdu() { wx.navigateTo({ url: '/pages/edu/edu' }); },

  // 文字版「我的概览」：不用翻页，一段话讲清我用得怎么样（可复制留档）
  copyMySummary() {
    const edu = (wx.getStorageSync('hb_eduDone') || []).length;
    const br = wx.getStorageSync('breatheCount') || 0;
    const sc = wx.getStorageSync('hb_scanCount') || 0;
    const d = new Date();
    const txt = [
      '【我的概览 · 心语伴】' + d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日',
      '· 已陪伴我 ' + (this.data.accompanyDays || 0) + ' 天，连续打卡 ' + (this.data.streakDays || 0) + ' 天',
      '· 累计心情记录 ' + (this.data.footprintSum || 0) + ' 条',
      '· 呼吸练习 ' + br + ' 次 · 身体扫描 ' + sc + ' 次',
      '· 心理小课已学 ' + edu + '/7 节',
      '· 聊天倾诉 ' + (this.data.chatTotal || 0) + ' 次 · 自评 ' + (this.data.assessTotal || 0) + ' 次',
      '',
      '记录本身就是一种照顾，我会继续好好对自己。'
    ].join('\n');
    wx.setClipboardData({ data: txt, success: () => wx.showToast({ title: '已复制我的概览', icon: 'success' }) });
  },

  // 清除本地记录：只清本机的小结/小课/安全包等，云端心情与成就徽章都保留
  clearLocalData() {
    wx.showModal({
      title: '清除本机记录？',
      content: '会清掉小结日记、小课进度、安全包、常用语、珍藏等本机数据；云端的心情记录和你的成就徽章都会保留。此操作不可撤销。',
      confirmText: '继续',
      cancelText: '再想想',
      success: (r) => {
        if (!r.confirm) return;
        wx.showModal({
          title: '最后确认',
          content: '真的要清空吗？（安全包也会被清掉，危急时就没法一键拨打了）',
          confirmText: '清空',
          cancelText: '取消',
          success: (r2) => {
            if (!r2.confirm) return;
            const keys = ['hbDayNote', 'hb_eduDone', 'hb_eduDays', 'hb_eduNote', 'hbSafeContacts', 'hbSafePeople',
              'hb_stFavs', 'hb_small', 'hb_scanFeel', 'hbThoughtBox', 'hbThought', 'timeLetter', 'hbLetterBox',
              'hb_myPhrases', 'hb_favs', 'breatheWeek', 'hb_breatheStreak', 'hb_breatheDay', 'hb_breatheMins',
              'breatheCount', 'hb_milestone', 'hb_night_msg', 'hb_weekRecap', 'hb_triageDone', 'chatLowCareSeen'];
            keys.forEach((k) => wx.removeStorageSync(k));
            this.setData({ safePeople: '', favCount: 0, eduDone: 0 });
            wx.showToast({ title: '本机记录已清空', icon: 'success' });
          }
        });
      }
    });
  },

  viewDataMap() {
    wx.showModal({
      title: '你的数据放在哪',
      content: '本机（不联网、只有你能看）：心情/想法/时光信/三件小事/呼吸记录。\n云端（你的微信身份，仅作备份与安全守护）：\n· 情绪记录与测评分数 —— 用来回看与 AI 记忆\n· 危机提醒/回访 —— 在关键时刻联系可信任的人\n· 反馈 —— 帮我们改进\n随时可以「导出」带走，或一键清空云端。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 一键导出心情数据（数据可携带权）：读自己全部通讯 → 复制 JSON 文本
  async exportData() {
    let openid = app.globalData.openid;
    if (!openid) openid = await app.login();
    if (!openid) { wx.showToast({ title: '登录中，请稍后再试', icon: 'none' }); return; }
    const db = wx.cloud.database();
    const grab = (coll) =>
      db.collection(coll).where({ openid }).orderBy('createdAt', 'desc').limit(30).get()
        .then((r) => (r && r.data) || [])
        .catch(() => []);
    try {
      const [moods, assessments, crisis, feedbacks] = await Promise.all([
        grab('moods'), grab('assessments'), grab('crisisAlerts'), grab('feedbacks')
      ]);
      // 本地数据（数据主权：一并打包，随时带走）
      const local = {};
      const localKeys = ['qingDayNote', 'hb_eduDone', 'hb_eduDays', 'hbSafeContacts', 'hbSafePeople', 'hb_stFavs', 'hb_small', 'hb_scanFeel', 'hbThoughtBox', 'hbLetterBox', 'breatheWeek'];
      localKeys.forEach((k) => { const v = wx.getStorageSync(k); if (v) local[k] = v; });
      const payload = {
        app: 'heartbuddy-miniprogram',
        exportedAt: new Date().toISOString(),
        note: '以下数据仅为你在本小程序中的记录（对话内容不入库），openid 已脱敏。',
        counts: { moods: moods.length, assessments: assessments.length, crisisAlerts: crisis.length, feedbacks: feedbacks.length, localKeys: Object.keys(local).length },
        data: {
          moods: this.mask(moods),
          assessments: this.mask(assessments),
          crisisAlerts: this.mask(crisis),
          feedbacks: this.mask(feedbacks),
          localRecords: local
        }
      };
      const text = JSON.stringify(payload, null, 2);
      const total = payload.counts.moods + payload.counts.assessments + payload.counts.crisisAlerts + payload.counts.feedbacks;
      wx.setClipboardData({
        data: text,
        success: () => wx.showModal({
          title: '已复制导出数据',
          content: `共 ${total} 条记录已按 JSON 复制到剪贴板（仅本人数据，已脱敏）。粘贴到备忘录即可保存。`,
          showCancel: false,
          confirmText: '知道了'
        })
      });
    } catch (e) {
      console.error('[profile] 导出失败', e);
      wx.showToast({ title: '导出失败，请重试', icon: 'none' });
    }
  },

  // 简单脱敏：openid 只保留前 6 位
  mask(list) {
    return list.map((it) => ({ ...it, openid: (it.openid || '').slice(0, 6) + '…' }));
  },

  onFeedback(e) {
    this.setData({ feedback: e.detail.value });
  },

  async submitFeedback() {
    const content = this.data.feedback.trim();
    if (!content || this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const db = wx.cloud.database();
      await db.collection('feedbacks').add({
        data: { openid: this.data.openid, comment: content, rating: 5, createdAt: Date.now() }
      });
      this.setData({ feedback: '', submitting: false });
      wx.showToast({ title: '谢谢你，已收到', icon: 'success' });
    } catch (e) {
      this.setData({ submitting: false });
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  },

  viewPrivacy() {
    wx.showModal({
      title: '隐私说明',
      content: '心语伴不会收集你的真实姓名、位置与通讯录。对话仅用于情绪陪伴服务。AI 生成内容仅供参考，不构成医疗建议。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  goReport() { wx.navigateTo({ url: '/pages/report/report' }); },

  goOps() { wx.navigateTo({ url: '/pages/ops/ops' }); },

  // 隐私合规：一键清空本人全部记录（双确认，防误触）
  clearData() {
    wx.showModal({
      title: '清空我的记录？',
      content: '将删除本机已同步的全部情绪记录、自评与危机提醒，且不可恢复。是否继续？',
      confirmText: '仍要清空',
      confirmColor: '#e05c4e',
      success: (r) => {
        if (!r.confirm) return;
        wx.showModal({
          title: '最后确认',
          content: '删除后无法找回。确定清空？',
          confirmText: '确认清空',
          confirmColor: '#e05c4e',
          success: async (r2) => {
            if (!r2.confirm) return;
            wx.showLoading({ title: '清理中…' });
            try {
              const res = await api.call('clearMyData');
              wx.hideLoading();
              if (res && res.ok) {
                this.loadStats();
                wx.showToast({ title: '已清空', icon: 'success' });
              } else {
                wx.showToast({ title: (res && res.error) || '清理失败', icon: 'none' });
              }
            } catch (e) {
              wx.hideLoading();
              wx.showToast({ title: '清理失败，请重试', icon: 'none' });
            }
          }
        });
      }
    });
  },

  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); },

  // 隐私合规：重新查看《用户须知与免责声明》（清除本机已同意标记，回到欢迎页）
  resetPrivacy() {
    wx.showModal({
      title: '重新查看隐私指引？',
      content: '将退出当前会话并回到欢迎页，重新展示《用户须知与免责声明》，需要再次点击同意才能继续。',
      confirmText: '重新查看',
      success: (r) => {
        if (!r.confirm) return;
        wx.removeStorageSync('privacyAgreed');
        wx.reLaunch({ url: '/pages/welcome/welcome' });
      }
    });
  }
});