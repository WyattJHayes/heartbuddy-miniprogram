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
    favsToday: [],    // 今天珍藏的
    favsEarlier: [],  // 更早珍藏的
    stickies: [],     // 📌 便签本（聊天「留下一句」，本地）
    stickiesOpen: false,
    breatheTotal: 0,  // 呼吸累计（本地计数）
    scanTotal: 0,    // 扫描累计（本地计数）
    noteTotal: 0,   // 晚间小结累计篇数（本地）
    eduDone: 0,
    safeLine: '',     // 安全包速览一句
    roleName: '',     // 当前身份名
    stoodBadge: '',   // 撑过天数一句          // 心理小课已学节数
    nextBadge: null,     // 下一枚待解锁徽章
    yearStat: null,      // 年度统计（今年记录条数/天数）
    eduTotal: 8,
    showFavs: false,
    favCount: 0,
    // 日签问候
    greetEmoji: '🌤',
    greetText: '',
    // 考前倒计时（学生场景：设一次考试日，剩下几天心里有数）
    examInfo: null,
    examToday: '',
    // 每日轻提醒
    remindOn: false,
    remindTime: '21:00'
  },

  onShow() {
    this.setGreet();
    this.loadPlanInfo();
    this.loadStats();
    this.refreshBadges();
    this.setData({ eduDone: (wx.getStorageSync('hb_eduDone') || []).length });
    this.setData({ breatheTotal: wx.getStorageSync('breatheCount') || 0, scanTotal: wx.getStorageSync('hb_scanCount') || 0 });
    this.setData({ noteTotal: Object.keys(wx.getStorageSync('hbDayNote') || {}).length });
    this.calcYearStat();
    this.setData({ accompanyMilestoneText: this.accompanyMilestone(this.data.accompanyDays || 0) });
    // 安全包速览：几个人、多久没更新了
    const ppl = (wx.getStorageSync('hbSafePeople') || '').trim();
    const ts = wx.getStorageSync('hbSafePackTs') || 0;
    let safeLine = '';
    if (ppl) {
      const n = ppl.split('、').filter(Boolean).length;
      const days = ts ? Math.floor((Date.now() - ts) / 86400000) : null;
      safeLine = n + ' 位可信赖的人' + (days === null ? '' : days >= 30 ? ' · 超 ' + days + ' 天没更新，去看看 TA 们' : days > 0 ? ' · ' + days + ' 天前更新' : ' · 今天刚更新');
    }
    this.setData({ safeLine });
    const stoodN = Number(wx.getStorageSync('hb_stoodCount') || 0);
    if (stoodN > 0 && !this.data.stoodBadge) this.setData({ stoodBadge: '🌿 已有 ' + stoodN + ' 天「我撑过来了」' });
    const RN = { student: '学生', teacher: '老师', parent: '家长', friend: '朋友' };
    const role = wx.getStorageSync('hb_role') || '';
    this.setData({ roleName: RN[role] || '' });
    this.refreshFavs();
    this.loadExam();
    this.loadRemind();
  },

  // ---- 每日轻提醒：约定一个时间，到点温柔问一句 ----
  loadRemind() {
    const cfg = wx.getStorageSync('hb_dailyRemind') || {};
    this.setData({ remindOn: !!cfg.on, remindTime: cfg.time || '21:00' });
  },

  remindSwitch(e) {
    const on = !!e.detail.value;
    if (on) {
      wx.setStorageSync('hb_dailyRemind', { on: true, time: this.data.remindTime });
      wx.showToast({ title: '已开启 · 到点会轻声提醒', icon: 'none' });
    } else {
      wx.removeStorageSync('hb_dailyRemind');
      wx.showToast({ title: '已关掉每日提醒', icon: 'none' });
    }
    this.setData({ remindOn: on });
  },

  remindTimeChange(e) {
    const t = e.detail.value;
    if (!t) return;
    this.setData({ remindTime: t });
    wx.setStorageSync('hb_dailyRemind', { on: this.data.remindOn, time: t });
    wx.showToast({ title: '提醒时间已改到 ' + t, icon: 'none' });
  },

  // ---- 考前倒计时 ----
  // 读本地考试日 → 算出「还有 N 天 / 就是今天 / 已考完」三态文案
  loadExam() {
    const dateStr = wx.getStorageSync('hb_examDate') || '';
    const name = wx.getStorageSync('hb_examName') || '考试';
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const today = this.fmtDate(t);
    this.setData({ examToday: today });
    if (!dateStr) { this.setData({ examInfo: null }); return; }
    const ex = new Date(dateStr); ex.setHours(0, 0, 0, 0);
    const DAY = 86400000;
    const days = Math.round((ex.getTime() - t.getTime()) / DAY);
    let body = '', tone = '', btn = null;
    if (days > 3) {
      body = `还有 ${days} 天。按自己的节奏复习，也记得吃饭睡觉。`;
    } else if (days > 0) {
      body = `还有 ${days} 天。紧张是正常的——现在最有用的是深呼吸。`;
      btn = { text: '去呼吸放松', url: '/pages/breathe/breathe' };
    } else if (days === 0) {
      body = '就是今天。你已经准备很久了，做好深呼吸，会顺利的。';
      btn = { text: '考前 1 分钟呼吸', url: '/pages/breathe/breathe' };
    } else {
      body = `已经过去了 ${-days} 天。辛苦了。今晚好好睡一觉。`;
      btn = { text: '清掉这次倒计时', clear: true };
    }
    this.setData({ examInfo: { dateStr, name, days, body, btn } });
  },

  // picker 选择考试日
  examDateChange(e) {
    const v = e.detail.value;
    if (!v) return;
    // 顺带让用户写一句「这是什么考试」
    wx.showModal({
      title: '这是什么考试？',
      editable: true,
      placeholderText: '例如：数学期中',
      confirmText: '记下',
      success: (r) => {
        if (!r.confirm) return;
        wx.setStorageSync('hb_examDate', v);
        wx.setStorageSync('hb_examName', (r.content || '').trim() || '考试');
        this.loadExam();
        wx.showToast({ title: '已记下，加油', icon: 'success' });
      }
    });
  },

  examAction() {
    const exam = this.data.examInfo;
    if (!exam || !exam.btn) return;
    if (exam.btn.clear) {
      wx.showModal({
        title: '清掉倒计时？',
        content: '考试已经结束，把这格倒计时收起来吧。',
        confirmText: '收起',
        success: (r) => {
          if (!r.confirm) return;
          wx.removeStorageSync('hb_examDate');
          wx.removeStorageSync('hb_examName');
          this.loadExam();
        }
      });
      return;
    }
    if (exam.btn.url) wx.navigateTo({ url: exam.btn.url });
  },

  copyMilestone(e) {
    const t = e.currentTarget.dataset.t;
    if (!t) return;
    wx.setClipboardData({ data: '我和心语伴相伴 ' + (this.data.accompanyDays || 0) + ' 天：' + t, success: () => wx.showToast({ title: '已复制这份纪念', icon: 'success' }) });
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
  goHelperSafe() { wx.navigateTo({ url: '/pages/helper/helper' }); },

  // 我的身份：显示当前角色，点击去欢迎页换一个
  showRole() {
    const role = wx.getStorageSync('hb_role') || '';
    const NAMES = { student: '学生', teacher: '老师', parent: '家长', friend: '朋友', '' : '还没选' };
    wx.showModal({
      title: '我在心语的身份',
      content: '现在是：' + (NAMES[role] || role || '还没选') + '。想去换个身份吗？换完聊天开场也会跟着变。',
      confirmText: '去换',
      cancelText: '先不',
      success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/welcome/welcome' }); }
    });
  },

  // 我的心情档案 · 一键导出（纯本地汇总，复制成一段话）
  exportProfile() {
    const L = [];
    const moodN = Object.keys(wx.getStorageSync('hbDayNote') || {}).length;
    const breatheN = wx.getStorageSync('breatheCount') || 0;
    const scanN = wx.getStorageSync('hb_scanCount') || 0;
    const stoodN = wx.getStorageSync('hb_stoodCount') || 0;
    const assessN = (wx.getStorageSync('hb_assessHist') || []).length || Number(wx.getStorageSync('ach_assess') === true);
    const gold = (wx.getStorageSync('hb_goldenLines') || []).length;
    const phrases = (wx.getStorageSync('hb_myPhrases') || []).length;
    L.push('🌿 我在「心语伴」的小小足迹：');
    if (moodN) L.push('· 认真记过 ' + moodN + ' 天心情笔记');
    if (breatheN) L.push('· 一起呼吸过 ' + breatheN + ' 次');
    if (scanN) L.push('· 做过 ' + scanN + ' 次身体扫描');
    if (stoodN) L.push('· 有 ' + stoodN + ' 天，我对自己说「我撑过来了」');
    if (assessN) L.push('· 做过 ' + assessN + ' 次焦虑自评');
    if (gold) L.push('· 攒了 ' + gold + ' 句自己的金句');
    if (phrases) L.push('· 存了 ' + phrases + ' 句常用语');
    L.push('');
    L.push('都是一点点走过来的痕迹。继续慢慢来。');
    wx.setClipboardData({ data: L.join('\n'), success: () => wx.showToast({ title: '已复制我的档案 📋', icon: 'none' }) });
  },

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

  // ---- 📌 我的便签本（聊天「留下一句」，本地）----
  refreshStickies() {
    const z = (n) => String(n).padStart(2, '0');
    const list = (wx.getStorageSync('hb_stickyNotes') || []).map((s) => {
      const d = new Date(s.at);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      const sameYear = d.getFullYear() === now.getFullYear();
      const when = sameDay
        ? '今天 ' + z(d.getHours()) + ':' + z(d.getMinutes())
        : z(d.getMonth() + 1) + '/' + z(d.getDate()) + (sameYear ? '' : '/' + String(d.getFullYear()).slice(2));
      return { t: s.t, at: s.at, when };
    });
    this.setData({ stickies: list });
  },
  openStickies() { this.refreshStickies(); this.setData({ stickiesOpen: true }); },
  closeStickies() { this.setData({ stickiesOpen: false }); },
  copySticky(e) { wx.setClipboardData({ data: e.currentTarget.dataset.t, success: () => wx.showToast({ title: '已复制', icon: 'success' }) }); },
  deleteLastSticky() {
    const list = wx.getStorageSync('hb_stickyNotes') || [];
    if (!list.length) return;
    list.shift();
    wx.setStorageSync('hb_stickyNotes', list);
    this.refreshStickies();
    wx.showToast({ title: '已删除最近一条', icon: 'none' });
  },

  // 导出我的本地数据：把关键的使用足迹整理成一段文字，一键复制存档（尊重「我的数据我做主」）
  exportMyData() {
    const lines = ['【心语伴 · 我的本地数据导出】', '时间：' + new Date().toLocaleString('zh-CN', { hour12: false })];
    lines.push('');
    lines.push('· 陪你 ' + (this.data.streakDays || 0) + ' 天');
    lines.push('· 累计心情记录 ' + (this.data.footprintSum || 0) + ' 条');
    lines.push('· 连续倾诉 ' + ((wx.getStorageSync('hb_talkStreak') || {}).d || 0) + ' 天');
    lines.push('· 呼吸累计 ' + (this.data.breatheTotal || 0) + ' 分钟（目标完成 ' + (this.data.breathDoneTotal || 0) + ' 次）');
    lines.push('· 身体扫描 ' + (this.data.scanTotal || 0) + ' 次');
    lines.push('· 心理小课已学 ' + this.data.eduDone + ' 节');
    lines.push('· 自评完成 ' + (this.data.assessTotal || 0) + ' 次');
    lines.push('· 珍藏 ' + this.data.favs.length + ' 条 · 便签 ' + this.data.stickies.length + ' 条');
    lines.push('· 已点亮徽章 ' + this.data.badges.filter((b) => b.got).length + ' / ' + (this.data.badgeTotal || 0) + ' 枚');
    lines.push('');
    lines.push('以上数据默认只存在你的本地与你的云端账号下，可随时在「隐私政策」里了解去向。');
    wx.showModal({
      title: '导出本地数据',
      content: '把上面的概要复制成文字（不含对话原文，只含统计）。对话与心情细节留在你的手机里。',
      confirmText: '复制',
      success: (r) => r.confirm && wx.setClipboardData({
        data: lines.join('\n'),
        success: () => wx.showToast({ title: '已复制，可粘贴到备忘录', icon: 'success' })
      })
    });
  },

  // 说给爸妈听：把这段时间的成长写成一段暖话（叙述版，不是数据清单）
  tellParents() {
    const days = this.data.streakDays || 0;
    const moods = this.data.footprintSum || 0;
    const breathe = this.data.breatheTotal || 0;
    const edu = this.data.eduDone || 0;
    const d = new Date();
    const lines = ['爸爸妈妈，想跟你们说一件小事 💛', ''];
    lines.push('这段时间，我其实一直有在学着照顾自己：');
    const bits = [];
    if (moods) bits.push('· 我记下了 ' + moods + ' 次心情——高兴的、难过的，都没有让它烂在心里');
    if (breathe) bits.push('· 我练过 ' + breathe + ' 分钟的呼吸，紧张的时候会先缓一缓');
    if (edu) bits.push('· 我学了 ' + edu + ' 节心理小课，正在学着和压力相处');
    if (days) bits.push('· 有 ' + days + ' 天，我都来找过这个小小的「树洞」');
    if (!bits.length) bits.push('· 我刚来这个 App，正准备开始认真照顾自己');
    lines.push.apply(lines, bits);
    lines.push('');
    lines.push('如果哪天我状态不太好，那不一定是不努力，可能只是那天有点累。');
    lines.push('不用急着教育我「要坚强」——你轻轻问我一句「今天怎么样」，对我来说就是很大的支持。');
    lines.push('');
    lines.push('写于 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 来自心语伴 🌿');
    wx.showModal({
      title: '说给爸妈听',
      content: '生成一段「我最近在怎么照顾自己」的话，复制后发给他们——用他们的语言，说你的努力。',
      confirmText: '复制',
      success: (r) => r.confirm && wx.setClipboardData({
        data: lines.join('\n'),
        success: () => wx.showToast({ title: '已复制，可以发给爸妈啦 💛', icon: 'none' })
      })
    });
  },

  // 自己写一条常用语：不想等聊天攒，直接加
  addPhrase() {
    const that = this;
    wx.showModal({
      title: '写一条常用语',
      editable: true,
      placeholderText: '例如：我可以慢慢来',
      success: (r) => {
        if (!r.confirm) return;
        const t = (r.content || '').trim().slice(0, 50);
        if (!t) { wx.showToast({ title: '写了才会存进去哦', icon: 'none' }); return; }
        const list = wx.getStorageSync('hb_myPhrases') || [];
        if (list.includes(t)) { wx.showToast({ title: '这条已经在啦', icon: 'none' }); return; }
        if (list.length >= 5) list.shift();
        list.push(t);
        wx.setStorageSync('hb_myPhrases', list);
        wx.showToast({ title: '存好了 🍀', icon: 'none' });
        that.myPhrases();
      }
    });
  },

  // 我的常用语：聊天页攒下的口头禅，在这里回看/一键清空
  myPhrases() {
    const list = wx.getStorageSync('hb_myPhrases') || [];
    if (!list.length) {
      wx.showModal({ title: '我的常用语', content: '还没有常用语。在聊天里长按 AI 说的话，选「并入我的常用语」，它就会出现在这里。', showCancel: false, confirmText: '知道啦' });
      return;
    }
    const body = list.map((t, i) => (i + 1) + '）' + t).join('\n');
    wx.showModal({
      title: '我的常用语（' + list.length + '/5）',
      content: body + '\n\n清空后可以重新攒。',
      confirmText: '清空',
      cancelText: '保留',
      success: (r) => {
        if (r.confirm) {
          wx.removeStorageSync('hb_myPhrases');
          wx.showToast({ title: '已清空，随时重新攒 🍀', icon: 'none' });
        }
      }
    });
  },

  // 送给朋友的一句鼓励：朋友正难时，说「绵绵的话」而不是「大道理」（三句可复制）
  encourageFriend() {
    const d = new Date();
    const lines = [
      '想送给你三句，随时可以用 🍀',
      '',
      '1）「我在。你想说的时候告诉我，不想说我们就安静待着。」',
      '2）「你现在这样就很好——别提‘应该开心’，你已经撑得很辛苦了。」',
      '3）「要不要一起出去走走？不走也行，陪你在线上待着。」',
      '',
      '朋友不是要接住你所有的情绪，是让你知道：你不是一个人。',
      '—— ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日'
    ];
    wx.showModal({
      title: '送给朋友的一句鼓励',
      content: '复制三句「不教育、只陪伴」的话，发给正需要它的朋友——比「别想太多有用得多。」',
      confirmText: '复制',
      success: (r) => r.confirm && wx.setClipboardData({
        data: lines.join('\n'),
        success: () => wx.showToast({ title: '已复制，可以发给 TA 了 🍀', icon: 'none' })
      })
    });
  },

  // ---- 我的珍藏（导航页长按珍藏，本地）----
  refreshFavs() {
    const favs = wx.getStorageSync('hb_favs') || [];
    this.setData({ favCount: favs.length });
  },

  openFavs() {
    const favs = wx.getStorageSync('hb_favs') || [];
    // 分组：今天珍藏的 / 更早的（时间字段是 toLocaleString 字符串）
    const todayStr = new Date().toLocaleDateString('zh-CN');
    const isToday = (t) => String(t || '').includes(todayStr.slice(0, 4)) && String(t || '').includes((new Date().getMonth() + 1) + '/' + new Date().getDate());
    const favsToday = favs.filter((f) => isToday(f.time));
    const favsEarlier = favs.filter((f) => !isToday(f.time));
    this.setData({ showFavs: true, favs, favsToday, favsEarlier });
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

  // 复制徽章列表：把已点亮徽章导出为文字（分享/存档）
  copyBadges() {
    const got = (this.data.badges || []).filter((b) => b.got);
    if (!got.length) { wx.showToast({ title: '还没有点亮徽章，先去用起来吧', icon: 'none' }); return; }
    const txt = ['【心语伴 · 我的成就徽章】', `已点亮 ${got.length}/${this.data.badgeTotal || 0} 枚`, '']
      .concat(got.map((b) => `${b.emoji} ${b.title}${b.gotDate ? '（' + b.gotDate + '）' : ''} —— ${b.desc}`))
      .join('\n');
    wx.setClipboardData({ data: txt, success: () => wx.showToast({ title: '已复制徽章列表', icon: 'success' }) });
  },

  // 成就徽章（本地记录解锁情况）
  refreshBadges() {
    const defs = [
      { key: 'ach_firstRecord', emoji: '🌱', title: '走出第一步', desc: '记录第一条心情' },
      { key: 'ach_streak3', emoji: '🔥', title: '坚持 3 天', desc: '连续打卡 3 天' },
      { key: 'ach_streak7', emoji: '🌿', title: '坚持 7 天', desc: '连续打卡 7 天' },
      { key: 'ach_breathe',     emoji: '🍃', title: '一呼一吸', desc: '完成一次呼吸练习' },
      { key: 'ach_breathe5',    emoji: '🧘', title: '呼吸行者', desc: '呼吸练习累计 5 次' },
      { key: 'ach_breathe7day', emoji: '🌿', title: '一周一息', desc: '连续 7 天完成每日放松目标' },
      { key: 'ach_assess',      emoji: '📋', title: '认识自己', desc: '完成一次自评' },
      { key: 'ach_letter',      emoji: '💌', title: '写给未来', desc: '寄出时光信' },
      { key: 'ach_care',        emoji: '💛', title: '也请心语来看我', desc: '安排一次 24h 回访' },
      { key: 'ach_fav',         emoji: '📌', title: '念念不忘', desc: '珍藏一句话' },
      { key: 'ach_scan',        emoji: '🧭', title: '安放自己', desc: '完成 1 次身体扫描' },
      { key: 'ach_scan3',       emoji: '🌌', title: '内在旅行者', desc: '身体扫描累计 3 次' },
      { key: 'ach_small3',      emoji: '💫', title: '微小而确定', desc: '一天之内做完 3 件小事' },
      { key: 'ach_share',       emoji: '🤝', title: '陪伴他人', desc: '把心语伴分享出去' },
      { key: 'ach_edu',        emoji: '🎓', title: '小学霸', desc: '学完心理小课全部 8 节' },
      { key: 'ach_askOut',     emoji: '📣', title: '开口一次', desc: '复制求助话术发给信任的人' },
      { key: 'ach_edu7',       emoji: '🔥', title: '连学 7 天', desc: '心理小课连续学习一周' }
    ];
    const scanCount = wx.getStorageSync('hb_scanCount') || 0;
    const eduDone = (wx.getStorageSync('hb_eduDone') || []).length >= 8;
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
    const badgePct = Math.round(gotCount / badges.length * 100);
    this.setData({ badges, gotCount, badgeTotal: badges.length, nextBadge: next, badgePct });
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
      // 近 7 天练习格子：当天做过呼吸或身体扫描即点亮（本地 breezeWeek + hb_scanDoneLog）
      const practice7 = [];
      const breathDays = new Set((wx.getStorageSync('breatheWeek') || []).map((t) => new Date(t).toDateString()));
      const scanDays = new Set((wx.getStorageSync('hb_scanDoneLog') || []).map((t) => new Date(t).toDateString()));
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * DAY);
        practice7.push(breathDays.has(d.toDateString()) || scanDays.has(d.toDateString()) ? 1 : 0);
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
      // 本月记录天数 / 本月已过天数（进度条）
      const nowD = new Date();
      const daysInMonth = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0).getDate();
      const passed = nowD.getDate();
      const mDaySet = new Set(mList.map((m) => new Date(m.createdAt).getDate()));
      const monthProg = { done: mDaySet.size, passed, pct: Math.round(mDaySet.size / passed * 100) };
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
        practice7Days: practice7,
        wkLabels: wk,
        monthAvgInt,
        monthProg,
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
      const talkD = (wx.getStorageSync('hb_talkStreak') || {}).d || 0;
      ctx.fillText(`已陪你 ${this.data.streakDays || 0} 天 · 连续倾诉 ${talkD} 天 · 写过 ${this.data.footprintSum || 0} 次心情`, 150, 168);
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

  // 我的徽章墙：把已点亮的徽章拼成一张卡片保存（坚持看得见，可分享给家人老师）
  async drawBadgeWall() {
    if (this._wallBusy) return;
    this._wallBusy = true;
    try {
      const q = this.createSelectorQuery();
      const res = await new Promise((resolve) => {
        q.select('#badgeWall').fields({ node: true, size: true }).exec((r) => resolve(r && r[0] && r[0].node ? r[0] : null));
      });
      if (!res) { wx.showToast({ title: '画布就绪中，再试一次', icon: 'none' }); return; }
      const canvas = res.node;
      const ctx = canvas.getContext('2d');
      canvas.width = 300 * 2; canvas.height = 260 * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = '#fdf6ee'; ctx.fillRect(0, 0, 300, 260);
      ctx.fillStyle = '#ead9c8'; ctx.fillRect(0, 0, 300, 8);
      ctx.fillStyle = '#8f6b1f'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('我的徽章墙 · 心语伴', 150, 34);
      const d = new Date();
      ctx.fillStyle = '#a3adc4'; ctx.font = '11px sans-serif';
      ctx.fillText(`${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 已点亮 ${this.data.badges.filter((b) => b.got).length}/${this.data.badgeTotal} 枚`, 150, 54);
      const got = this.data.badges.filter((b) => b.got);
      if (!got.length) {
        ctx.fillStyle = '#b8c2da'; ctx.font = '13px sans-serif';
        ctx.fillText('还没有点亮徽章——旅程从第一枚开始 🌱', 150, 120);
      } else {
        // 每枚一行：emoji + 名称 + 点亮日期（最多 17 行）
        got.slice(0, 12).forEach((b, i) => {
          const y = 84 + i * 15;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#7a6a5a'; ctx.font = '13px sans-serif';
          ctx.fillText(b.emoji, 60, y);
          ctx.textAlign = 'left';
          ctx.fillStyle = '#4a5568';
          ctx.fillText(b.title, 92, y);
          ctx.fillStyle = '#a3adc4'; ctx.font = '10px sans-serif';
          ctx.fillText((b.gotDate || '') ? '· ' + b.gotDate + ' 点亮' : '', 205, y);
        });
      }
      ctx.fillStyle = '#b8c2da'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('—— 心语伴：把每一次照顾自己，都认真记下来', 150, 244);
      const tmp = await new Promise((resolve) => {
        wx.canvasToTempFilePath({ canvas, success: resolve, fail: () => resolve(null) }, this);
      });
      this._wallBusy = false;
      if (!tmp || !tmp.tempFilePath) { wx.showToast({ title: '生成失败，请重试', icon: 'none' }); return; }
      await this.saveToAlbum(tmp.tempFilePath);
    } catch (e) { console.error('[profile] 徽章墙失败', e); this._wallBusy = false; }
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
    const talk = wx.getStorageSync('hb_talkStreak') || {};
    const phrases = (wx.getStorageSync('hb_myPhrases') || []).length;
    const d = new Date();
    const txt = [
      '【我的概览 · 心语伴】' + d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日',
      '· 已陪伴我 ' + (this.data.accompanyDays || 0) + ' 天，连续打卡 ' + (this.data.streakDays || 0) + ' 天',
      '· 连续来找心语聊天 ' + (talk.d || 0) + ' 天 · 常用语 ' + phrases + '/5 条',
      '· 累计心情记录 ' + (this.data.footprintSum || 0) + ' 条',
      '· 呼吸练习 ' + br + ' 次 · 身体扫描 ' + sc + ' 次',
      '· 心理小课已学 ' + edu + '/8 节' + (wx.getStorageSync('hb_eduGradDate') ? '（已结业）' : ''),
      '· 聊天倾诉 ' + (this.data.chatTotal || 0) + ' 次 · 自评 ' + (this.data.assessTotal || 0) + ' 次',
      '· 课后温故答对 ' + (wx.getStorageSync('hb_reviewOk') || 0) + ' 题',
      '',
      '记录本身就是一种照顾，我会继续好好对自己。',
      '',
      '（需要时随时拨 12356 心理援助热线，24 小时免费）'
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
              'breatheCount', 'hb_milestone', 'hb_night_msg', 'hb_weekRecap', 'hb_triageDone', 'chatLowCareSeen',
              'hb_eduWrong', 'hb_eduReview_', 'hb_reviewOk', 'hb_eduGradDate', 'hb_badgeDates', 'hb_phraseUses',
              'hb_scriptHist', 'hb_callLog', 'hb_stReads', 'hb_stDraws', 'hb_inputDraft', 'hb_nightManual',
              'hbCareGrad', 'hbCareGradSeen', 'hbCarePlan', 'crisisCheck', 'hbSafePackTs', 'hb_breathBroke',
              'hb_eduNote', 'hb_smallDays', 'hb_reviewDays', 'hb_stareCount',
              'hb_lessonCounts', 'hb_scanDoneLog', 'hb_phraseLast', 'hb_reviewAll', 'hbSafeNotes',
              'hb_eduSpanDays', 'hb_callTotal', 'hb_inputDraft',
              'hb_opsCache', 'hb_lastChatTs', 'hb_talkStreak', 'hb_triggerUse', 'ach_breathe7day', 'ach_talk_3', 'ach_talk_7', 'ach_talk_30', 'ach_talk_100', 'ach_review7', 'hb_tomorrowSmall',
              'hb_smallWeek', 'hb_stDrawPool', 'hb_relaxScan', 'hb_worryBox'];
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