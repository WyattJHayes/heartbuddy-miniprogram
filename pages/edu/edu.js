// pages/edu/edu.js —— 心理小课（本地知识卡片，随手学一点）
// 课程内容为通用心理健康小知识，不作为诊断依据；有需要请拨打全国热线 12356。

const LESSONS = [
  {
    key: 'emotion',
    icon: '🌸',
    title: '认识情绪：情绪没有好坏，都是信号',
    mins: '约 2 分钟',
    intro: '焦虑不是敌人，它只是大脑在说「我很在意」。学会先命名，再决定怎么办。',
    points: [
      '情绪来自身体信号，不是「想太多」的错。',
      '先停下来命名：我现在是生气、紧张，还是难过？',
      '命名本身就会让情绪「降温」一点点。',
      '情绪不会永远停留——平均几分钟到几小时就会开始回落。',
      '不是「不能有负面情绪」，而是「有了之后怎么照顾它」。'
    ],
    do: '今天：心里难受时，先对自己念一遍情绪的名字，再决定下一步。',
    quiz: { q: '情绪来了，第一步最好做什么？', opts: ['把它压下去当没事', '先命名：我现在是什么情绪', '责怪自己太敏感'], ans: 1, why: '命名情绪本身就能让它「降温」，这是情绪科学里最简单有效的一步。' }
  },
  {
    key: 'exam',
    icon: '📖',
    title: '考前焦虑：大脑为什么「报警」',
    mins: '约 3 分钟',
    intro: '考试前心跳加速、反复想「考砸了怎么办」——这是大脑在过度保护你。',
    points: [
      '大脑把大考当成「生存威胁」，于是启动报警系统（紧张、心跳快、坐不住）。',
      '报警系统帮不了你做题，它只会抢走你的专注力。',
      '把注意力拉回当下：做 3 次深呼吸，再读第一道题。',
      '「复习不完」很正常——没有人的准备是绝对充分的，考个「够用」就行。',
      '考后别再复盘对错：那一页已经翻过去了。',
    ],
    do: '考前 5 分钟：只做一件事——放慢呼吸 60 秒。',
    quiz: { q: '考前心跳加速、坐不住，大脑在做什么？', opts: ['它在攻击我', '它在过度报警「保护」我', '它坏了该修'], ans: 1, why: '报警系统帮不了你做题；先放慢呼吸，把专注力拿回来。' }
  },
  {
    key: 'sleep',
    icon: '🌙',
    title: '睡不着的晚上：先放下「必须睡着」',
    mins: '约 2 分钟',
    intro: '越努力睡着，越睡不着。试试把目标从「睡着」换成「躺着休息」。',
    points: [
      '「努力入睡」会让大脑更清醒——先放过这个目标。',
      '躺平也是一种休息，别把失眠想得太可怕。',
      '睡前 30 分钟不看屏幕，把手机放远一点。',
      '睡前写下明天的 3 件事，交给明天，不许在脑子里加班。',
      '如果躺了 20 分钟还精神，就起来喝口水、翻几页纸书，困了再躺。',
    ],
    do: '今晚把「必须早点睡」改成「我今晚会好好躺下」。',
    quiz: { q: '躺下 20 分钟还睡不着，更好的做法是？', opts: ['逼自己闭眼努力睡', '起来喝口水、翻几页纸书，困了再躺', '刷手机等困意'], ans: 1, why: '「努力入睡」会让大脑更清醒；中断一下再躺，反而更容易睡着。' }
  },
  {
    key: 'friends',
    icon: '🤝',
    title: '朋友闹掰了：关系裂缝怎么办',
    mins: '约 3 分钟',
    intro: '吵架、被误解、突然被冷落——友谊的裂缝很疼，但大多数裂缝是可以修的。',
    points: [
      '先分清：是「这件事」的问题，还是「这段关系」的问题？大多只是前者。',
      '气头上别发长消息：等情绪降下来（通常隔一晚）再谈。',
      '开口用「我感到…」而不是「你总是…」，指责会让对方竖起盾牌。',
      '道歉只说自己的部分：「那天我说话急了，对不起」，不用全揽。',
      '如果对方暂时不想理你：给彼此一点时间，友谊也呼吸。',
      '真正的朋友经得起一次好好谈；经不起谈的，散了也不全是你的错。',
    ],
    do: '想一句以「我感到…」开头的话，存着下次用。',
    quiz: { q: '和朋友吵架后，最好的第一步是？', opts: ['立刻发长消息解释清楚', '等情绪降下来再当面谈', '找别人评理站我这边'], ans: 1, why: '气头上的长消息常常变成互相指责；等情绪落地再谈，更容易被听见。' }
  },
  {
    key: 'social',
    icon: '📱',
    title: '刷手机越刷越焦虑：比较心怎么放',
    mins: '约 2 分钟',
    intro: '朋友圈里都是高光时刻，你却拿它对比自己的日常——这不公平。',
    points: [
      '你看到的是别人 1% 的高光，对比的却是自己 100% 的日常。',
      '焦虑变强时，先问：我现在是在「看」，还是在「比」？',
      '连续刷 20 分钟以上，情绪多半会变差——定时给自己一个停点。',
      '把「她好好看」换写成「我今天也认真过了一天」，练习改写内心台词。',
      '真忍不住比较时：去记录一条自己的小事，把注意力拿回来。',
    ],
    do: '现在关掉社交软件 10 分钟，喝口水再回来。',
    quiz: { q: '刷朋友圈感到焦虑，主要因为？', opts: ['手机辐射', '拿别人的高光对比自己的日常', '网速太慢'], ans: 1, why: '看见的只是精选集；意识到「我在比较」，就能把注意力拿回来。' }
  },
  {
    key: 'ask',
    icon: '📣',
    title: '向大人求助，不丢人',
    mins: '约 2 分钟',
    intro: '找大人帮忙不是「打小报告」，也不是「软弱」——那是给自己找更多支持。',
    points: [
      '心理困扰和感冒一样常见，全世界每年有数亿人经历过。',
      '求助 = 给自己增加支援，不是给父母添麻烦。',
      '「说出去很丢脸」的感觉会过去；一直硬扛的消耗不会。',
      '如果第一个大人没认真听，换一个再试——不是你的问题。',
      '真不知道找谁：学校心理老师、班主任、热线 12356，都在。',
    ],
    do: '把「向谁求助」写下来（1 个名字就够），需要时直接找 TA。',
    quiz: { q: '向大人求助意味着什么？', opts: ['软弱、丢人', '给自己增加支援', '给父母添麻烦'], ans: 1, why: '求助是一种能力：你在主动为自己的状态找资源，这恰恰是勇敢。' }
  },
  {
    key: 'parents',
    icon: '🏠',
    title: '和父母好好说话：从对抗到表达',
    mins: '约 3 分钟',
    intro: '很多争吵不是不爱，而是双方都在用「气话」表达在乎。换个说法，结果常常不一样。',
    points: [
      '先把目标从「吵赢」换成「让他们听懂」——这两个完全不同。',
      '用「我」开头说感受：「我很累、我很怕考不好」，比「你们根本不懂」更有效。',
      '挑时机：饭后散步、一起做事时开口，比饭桌上正式谈成功率高得多。',
      '给父母留台阶：「我知道你们是为我好，但我需要……」比指责更容易被接受。',
      '一次谈不成很正常——改的不是一次对话，而是沟通习惯，慢慢来。',
      '如果家里冲突已让你长期害怕/失眠，这不是你的错，请找老师或热线聊聊。',
    ],
    do: '今晚挑一句换成「我」开头说：把「你们别管我」换成「我需要一点自己的时间」。',
    quiz: { q: '和父母沟通时，哪种开场更容易被听懂？', opts: ['你们根本不懂我', '我很累，也很怕考不好', '别人家父母都比你俩好'], ans: 1, why: '「我」开头的感受表达不指向对方，防御会低很多——这是沟通课里最实用的一招。' }
  },
  {
    key: 'low',
    icon: '🍃',
    title: '低落时：只做「最小行动」',
    mins: '约 2 分钟',
    intro: '没力气不是偷懒，是身体在省电。这时候不要要求自己「振作」，只做最小的事。',
    points: [
      '先给事分个级：今天只要完成一件 5 分钟的事就算成功。',
      '把大任务拆小：写 1 行、走 5 步、洗把脸，都算数。',
      '去喝口水、拉开窗帘晒 10 秒太阳——身体先动，心情跟着动。',
      '如果连续多天提不起劲、睡不好或想伤害自己，请真的求助：父母、老师或热线。',
    ],
    do: '现在做一件 60 秒的事：站起来伸个懒腰。',
    quiz: { q: '低落没力气时，今天的目标准应该定成？', opts: ['必须振作完成全部', '一件 5 分钟的小事', '什么都不做'], ans: 1, why: '「最小行动」帮你慢慢回血，5 分钟的事也算今天的成功。' }
  }
];

const DONE_KEY = 'hb_eduDone';
const { calcStreak } = require('../../utils/streak');

Page({
  data: {
    lessons: [],
    doneMap: {},   // key -> true
    quizOk: {},    // key -> 随堂小测已答对
    answered: {},  // key -> 已选的选项下标
    streak: 0,     // 连续学习天数
    myNote: '',    // 学习心得：一句话写给自己（本地）
    review: null,  // 温故一题：全部学完后随机复习
    reviewOk: 0,   // 温故累计答对题数
    reviewAll: 0,  // 温故累计答题数（算正确率）
    reviewStreak: 0, // 温故连续天数
    gradDate: '',  // 结业日期（首次全部学完那天）
    gradSpan: 0,   // 学习总天数（首次学习→结业）
    studyDays: 0,  // 一共在多少天打开过小课
    studyCal: [],  // 近 14 天学习日历（最右=今天）
    lessonCounts: {}, // 每课学习次数
    doneCount: 0,
    total: LESSONS.length,
    openIdx: -1,
    kw: '',             // 课程搜索关键词
    todayGoal: '',      // 今日轻目标文案
    examTick: null,    // 考前 N 天轻卡（联动「我的」考试日）
    todayDone: false    // 今天是否学过
  },

  onLoad() {
    this.buildStudyTip();
    this.refreshRevRemind();
    let done = [];
    try { done = wx.getStorageSync(DONE_KEY) || []; } catch (e) {}
    const doneMap = {};
    (done || []).forEach((k) => { doneMap[k] = true; });
    this.setData({ myNote: wx.getStorageSync('hb_eduNote') || '' });
    this.setData({ reviewOk: wx.getStorageSync('hb_reviewOk') || 0 });
    this.setData({ reviewStreak: calcStreak(wx.getStorageSync('hb_reviewDays') || []) });
    this.setData({ reviewAll: wx.getStorageSync('hb_reviewAll') || 0 });
    this.setData({ gradDate: wx.getStorageSync('hb_eduGradDate') || '' });
    this.setData({ gradSpan: wx.getStorageSync('hb_eduSpanDays') || 0 });
    this.setData({ studyDays: (wx.getStorageSync('hb_eduDays') || []).length });
    // 今日轻目标：今天学过给「已经回顾」回执，没学过给「5 分钟就够」的轻承诺（当天有效）
    const learnedToday = (wx.getStorageSync('hb_eduDays') || []).includes(new Date().toDateString());
    this.setData({
      todayDone: learnedToday,
      todayGoal: learnedToday
        ? '今天已经打开过小课了——这几分钟，就是你照顾自己的证据 🌿'
        : '今天给心理小课 5 分钟就够：读完一节，就算今天的照顾做到了 🌱',
      examTick: this.buildExamTick()
    });
    // 全部学完：每天打开自动出一道温故题
    if (LESSONS.every((l) => doneMap[l.key])) {
      const rk = 'hb_eduReview_' + new Date().toDateString();
      if (!wx.getStorageSync(rk)) { wx.setStorageSync(rk, true); this.rollReview(); }
    }
    // 续学：自动展开第一节还没学完的课（全部学完则收起）
    let openIdx = -1;
    for (let i = 0; i < LESSONS.length; i++) { if (!doneMap[LESSONS[i].key]) { openIdx = i; break; } }
    this.setData({ lessons: this.filterLessons(this.data.kw).map((l) => this.shuffleQuiz(l)), doneMap, doneCount: Object.keys(doneMap).length, quizOk: {}, answered: {}, streak: calcStreak(wx.getStorageSync('hb_eduDays') || []), openIdx });
    // 近 14 天学习日历：学过的天点亮（最右是今天）
    const set = new Set(wx.getStorageSync('hb_eduDays') || []);
    const cal = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      cal.push({ on: set.has(d.toDateString()), today: i === 0 });
    }
    this.setData({ studyCal: cal });
    this.setData({ lessonCounts: wx.getStorageSync('hb_lessonCounts') || {} });
  },

  // 小测选项打乱：防止背位置，真正记住内容（答案下标重映射）
  shuffleQuiz(l) {
    if (!l || !l.quiz) return l;
    const q = l.quiz;
    const idx = q.opts.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    return Object.assign({}, l, { quiz: Object.assign({}, q, { opts: idx.map((i) => q.opts[i]), ans: idx.indexOf(q.ans) }) });
  },

  filterLessons(kw) {
    const k = (kw || '').trim().toLowerCase();
    if (!k) return LESSONS;
    return LESSONS.filter((l) =>
      (l.title + l.intro + l.points.join(' ') + l.do).toLowerCase().includes(k));
  },
  onSearch(e) {
    this.setData({ kw: e.detail.value, lessons: this.filterLessons(e.detail.value).map((l) => this.shuffleQuiz(l)) });
  },
  clearSearch() { this.setData({ kw: '', lessons: LESSONS }); },

  // 考前 N 天：联动「我的」里设过的考试日，考前给学习节奏 + 稳住提示
  buildExamTick() {
    const dateStr = wx.getStorageSync('hb_examDate') || '';
    const name = wx.getStorageSync('hb_examName') || '考试';
    if (!dateStr) return null;
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const ex = new Date(dateStr); ex.setHours(0, 0, 0, 0);
    const DAY = 86400000;
    const days = Math.round((ex.getTime() - t.getTime()) / DAY);
    if (days < 0 || days > 30) return null;
    let text = '';
    if (days > 7) text = `离${name}还有 ${days} 天——小课照常，把心安在这 5 分钟里就好。`;
    else if (days > 3) text = `还剩 ${days} 天。现在比「多学一点」更有用的是「稳住自己」：读一节小课吧。`;
    else if (days > 0) text = `还剩 ${days} 天。紧张正常——先做一次深呼吸，再决定学什么。`;
    else if (days === 0) text = `就是今天。深呼吸，你已经准备好了。`;
    else return null;
    return { days, name, text };
  },

  toggle(e) {
    const i = Number(e.currentTarget.dataset.i);
    this.setData({ openIdx: this.data.openIdx === i ? -1 : i });
  },

  markDone(e) {
    const i = Number(e.currentTarget.dataset.i);
    const l = this.data.lessons[i];
    if (!l) return;
    if (l.quiz && !this.data.quizOk[l.key]) {
      wx.showToast({ title: '先答一答随堂小测吧', icon: 'none' });
      return;
    }
    let done = wx.getStorageSync(DONE_KEY) || [];
    if (!done.includes(l.key)) {
      done.push(l.key);
      wx.setStorageSync(DONE_KEY, done);
      // 学完自我回应：一句「此刻的你」给刚学完的自己（+整节里程碑）
      const ECHO = [
        '这一节学完，你对自己又了解了一点点 🎈',
        '今天这一点点，会在考场上帮到你 🌱',
        '认真学完的人，值得被自己夸一句 ☁️',
        '每完成一节，都是你跟焦虑拉开的一点距离',
        '刚学完的你，已经比昨天强了一点'
      ];
      const n = done.length;
      const milli = n % 5 === 0 ? ' —— 已连续学完 ' + n + ' 节，很不容易。' : '';
      wx.showToast({ title: '学完一节 🎉 ' + ECHO[(n - 1) % ECHO.length] + milli, icon: 'none', duration: 2600 });
    }
    const doneMap = this.data.doneMap;
    doneMap[l.key] = true;
    this.setData({ doneMap, doneCount: Object.keys(doneMap).length });
  },

  markStudyToday() {
    const days = wx.getStorageSync('hb_eduDays') || [];
    const t = new Date().toDateString();
    if (!days.includes(t)) { days.push(t); wx.setStorageSync('hb_eduDays', days.slice(-400)); }
  },
  // 每课学习次数：答对即学过一次（重学也计）
  bumpLessonCount(key) {
    const c = wx.getStorageSync('hb_lessonCounts') || {};
    c[key] = (c[key] || 0) + 1;
    wx.setStorageSync('hb_lessonCounts', c);
    this.setData({ lessonCounts: c });
  },

  // 随堂小测：答对自动点亮「学完」
  answerQuiz(e) {
    const i = Number(e.currentTarget.dataset.i);
    const o = Number(e.currentTarget.dataset.o);
    const l = this.data.lessons[i];
    if (!l || !l.quiz) return;
    this.markStudyToday();
    this.bumpLessonCount(l.key);
    const key = l.key;
    const answered = this.data.answered;
    answered[key] = o;
    if (o === l.quiz.ans) {
      const quizOk = this.data.quizOk;
      quizOk[key] = true;
      this.setData({ answered, quizOk, streak: calcStreak(wx.getStorageSync('hb_eduDays') || []) });
      let done = wx.getStorageSync(DONE_KEY) || [];
      if (!done.includes(key)) {
        done.push(key);
        wx.setStorageSync(DONE_KEY, done);
        const doneMap = this.data.doneMap;
        doneMap[key] = true;
        this.setData({ doneMap, doneCount: Object.keys(doneMap).length });
      }
      wx.showToast({ title: '答对了，已点亮 🎉', icon: 'success' });
      // 自动展开下一节未学完的课（学完最后一节则收起，专注温故）
      const lessons = this.data.lessons;
      let next = -1;
      for (let j = 0; j < lessons.length; j++) {
        if (!this.data.doneMap[lessons[j].key]) { next = j; break; }
      }
      if (next >= 0) setTimeout(() => this.setData({ openIdx: next }), 900);
      // 全部学完的这一天 = 结业日（只记一次）
      const doneMap2 = this.data.doneMap;
      if (LESSONS.every((l) => doneMap2[l.key]) && !wx.getStorageSync('hb_eduGradDate')) {
        const gd = new Date();
        wx.setStorageSync('hb_eduGradDate', gd.getFullYear() + ' 年 ' + (gd.getMonth() + 1) + ' 月 ' + gd.getDate() + ' 日');
        // 学习总天数：第一次学习日 → 结业日
        const days = wx.getStorageSync('hb_eduDays') || [];
        if (days.length >= 2) {
          const first = new Date(days[0]);
          const span = Math.max(1, Math.round((gd - first) / 86400000));
          wx.setStorageSync('hb_eduSpanDays', span);
        }
      }
    } else {
      this.setData({ answered });
      wx.showToast({ title: '再想想，不着急', icon: 'none' });
    }
  },

  resetAll() {
    wx.setStorageSync(DARK_KEY, []);
    this.onLoad();
    wx.showToast({ title: '已重开', icon: 'none' });
  },

  // 温故一题：全部学完后，随机抽一题再答一次（不计进度，纯温习）
  rollReview() {
    const all = LESSONS.filter((l) => l.quiz);
    if (!all.length) return;
    // 温故优先：先抽答错过的课；没错题才随机
    const wrong = wx.getStorageSync('hb_eduWrong') || [];
    const pool = wrong.length ? all.filter((l) => wrong.includes(l.key)) : all;
    const use = pool.length ? pool : all;
    const l0 = use[Math.floor(Math.random() * use.length)];
    const l = this.shuffleQuiz(l0);
    this.setData({ review: { key: l.key, icon: l.icon, title: l.title, quiz: l.quiz, picked: -1, ok: false } });
  },
  answerReview(e) {
    const o = Number(e.currentTarget.dataset.o);
    const rv = this.data.review;
    if (!rv || rv.picked >= 0) return;
    const ok = o === rv.quiz.ans;
    if (ok) {
      // 温故答对计数（本地）：结业卡上展示
      wx.setStorageSync('hb_reviewOk', (wx.getStorageSync('hb_reviewOk') || 0) + 1);
      wx.setStorageSync('hb_reviewAll', (wx.getStorageSync('hb_reviewAll') || 0) + 1);
    } else {
      wx.setStorageSync('hb_reviewAll', (wx.getStorageSync('hb_reviewAll') || 0) + 1);
    }
    this.setData({ reviewAll: wx.getStorageSync('hb_reviewAll') || 0 });
    if (ok) {
      // 温故连续天数：答对当天记一天
      const rd = wx.getStorageSync('hb_reviewDays') || [];
      const td = new Date().toDateString();
      if (!rd.includes(td)) { rd.push(td); wx.setStorageSync('hb_reviewDays', rd.slice(-400)); }
      const streak = calcStreak(rd);
      this.setData({ reviewOk: wx.getStorageSync('hb_reviewOk'), reviewStreak: streak });
      // 连续 7 天答对：一句专属鼓励（一次性）
      if (streak === 7 && !wx.getStorageSync('ach_review7')) {
        wx.setStorageSync('ach_review7', true);
        wx.showToast({ title: '连续 7 天温故答对 · 知识真的留下来啦 🌟', icon: 'none', duration: 2600 });
      }
    }
    // 错题本：答错记下、答对移出（温故时优先抽）
    const wrong = wx.getStorageSync('hb_eduWrong') || [];
    const i = wrong.indexOf(rv.key);
    if (ok) { if (i > -1) { wrong.splice(i, 1); wx.setStorageSync('hb_eduWrong', wrong); } }
    else if (i === -1) { wrong.push(rv.key); wx.setStorageSync('hb_eduWrong', wrong); }
    this.setData({ review: Object.assign({}, rv, { picked: o, ok }) });
    if (ok) wx.showToast({ title: '还记得，真棒 🎉', icon: 'success' });
    else wx.showToast({ title: '忘了一点，很正常', icon: 'none' });
  },

  // 学习心得：一句话（本地保存，写在结业卡上方）
  onNoteInput(e) { this.setData({ myNote: e.detail.value }); },
  copyMyNote() {
    const t = (this.data.myNote || '').trim();
    if (!t) { wx.showToast({ title: '还没写心得', icon: 'none' }); return; }
    wx.setClipboardData({ data: '我在心语伴心理小课写给自己的一句话：\n「' + t + '」', success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
  },

  saveNote() {
    const t = (this.data.myNote || '').trim();
    wx.setStorageSync('hb_eduNote', t.slice(0, 60));
    wx.showToast({ title: t ? '已记下 🌱' : '已清空', icon: 'none' });
  },

  // 结业卡：全部学完后可复制的一段「结业词」（本地，留念/分享）
  // 复制这一课：分享给朋友 / 转发到班群都方便（纯文本）
  // 今日学习心法：每天换一条「怎么学不焦虑」的小方法
  buildStudyTip() {
    const TIPS = [
      '先做 5 分钟最不想做的那科——开头最难，之后会顺',
      '把「我要学 2 小时」换成「我要做完 5 道题」，任务越具体越轻',
      '学 25 分钟，歇 5 分钟。歇的时候真的休息，别刷手机',
      '今天只求「弄懂一个点」，比囫囵过三章更有用',
      '错题是最好的老师：重做一遍，比新做十道更值',
      '背书出声读，手也跟着写——多个通道一起记',
      '睡前 10 分钟回想今天学的框架，记得更牢',
      '卡住超过 10 分钟就先跳过，做个标记回头再看',
      '把手机放到够不着的地方，物理隔离最有效',
      '告诉自己「先学 10 分钟」——往往一开始就停不下来了'
    ];
    const d = new Date();
    this.setData({ studyTip: TIPS[(d.getDate() * 7 + d.getMonth()) % TIPS.length] });
  },

  prepDaysInput(e) { this.setData({ prepDays: e.detail.value }); },
  prepSubsInput(e) { this.setData({ prepSubs: e.detail.value }); },
  // 备考小助手：天数和科目 → 平均分给每天，每科配 1 个动作
  genPrepPlan() {
    const days = parseInt(this.data.prepDays, 10);
    const subs = (this.data.prepSubs || '').split(/[,，]/).map((x) => x.trim()).filter(Boolean);
    if (!days || days < 1 || days > 60) { wx.showToast({ title: '先填一个 1-60 的天数', icon: 'none' }); return; }
    if (!subs.length) { wx.showToast({ title: '填一下科目，用逗号分隔', icon: 'none' }); return; }
    const ACTS = {
      数学: '3 道基础题，重方法不改资料', 语文: '2 分钟背，圈 3 个句式', 英语: '15 个高频词 + 一段朗读',
      物理: '吃透一个方法，做 3 题', 化学: '抄一套方程式，条件写旁边', 生物: '读一节，画 1 张迷你图',
      政治: '背 3 个点，各写一句解释', 历史: '把 3 个核心事件连成一段话', 地理: '看 1 个图组，默一遍要点'
    };
    const list = [];
    for (let d2 = 1; d2 <= days; d2++) {
      const sub = subs[(d2 - 1) % subs.length];
      list.push({ d: d2, sub: sub + ' · ' + (ACTS[sub] || '45 分钟上限，到点就停') });
    }
    this.setData({ planOut: list });
    wx.setStorageSync('hb_prepPlan', { at: Date.now(), list });
    wx.showToast({ title: '第 1 天按计划来就好 ☀️', icon: 'none' });
  },
  resetPrepPlan() { this.setData({ planOut: null }); },

  copyLesson(e) {
    const i = Number(e.currentTarget.dataset.i);
    const l = this.data.lessons[i];
    if (!l) return;
    const done = this.data.doneCount || 0;
    const body = [
      '【心语伴 · 心理小课】' + l.icon + ' ' + l.title,
      l.intro,
      '',
      ...l.points.map((p) => '· ' + p),
      '',
      '💚 今天可以这样做：' + l.do,
      done ? '（我已经学到第 ' + done + '/' + this.data.total + ' 节啦）' : ''
    ].filter(Boolean).join('\n');
    wx.setClipboardData({ data: body, success: () => wx.showToast({ title: '已复制这一课', icon: 'success' }) });
  },

  // 存一句「我的金句」：学到的那句进本地金库，欢迎页每天晒一条（最多 10 句）
  saveGolden(e) {
    const t = (e.currentTarget.dataset.t || '').trim();
    if (!t) return;
    const list = wx.getStorageSync('hb_goldenLines') || [];
    if (list.includes(t)) { wx.showToast({ title: '这句已经在金句里啦 💛', icon: 'none' }); return; }
    list.unshift(t);
    wx.setStorageSync('hb_goldenLines', list.slice(0, 10));
    wx.showToast({ title: '已存进「我的金句」💛', icon: 'none' });
  },

  onShareAppMessage() {
    return {
      title: this.data.gradDate ? '我在心语伴学完了 7 节心理小课 🎓' : '一起来学几分钟就能用的心理小课 📚',
      path: '/pages/edu/edu'
    };
  },

  copyGradText() {
    const d = new Date();
    const t = [
      '🎓 我在「心语伴」学完了全部 7 节心理小课',
      '（认识情绪 · 考前焦虑 · 睡不着 · 低落 · 朋友 · 社媒 · 求助）',
      '结业时间：' + d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日',
      '',
      '情绪没有好坏，它们都是信号；',
      '我学会在它来的时候，先命名，再照顾，然后求助如果需要。',
      '—— 这份证书属于一直没放弃照顾自己的我。'
    ].join('\n');
    wx.setClipboardData({ data: t, success: () => wx.showToast({ title: '已复制结业词 🎓', icon: 'success' }) });
  },

  callHotline() {
    wx.makePhoneCall({ phoneNumber: '12356', fail: () => {} });
  }
});