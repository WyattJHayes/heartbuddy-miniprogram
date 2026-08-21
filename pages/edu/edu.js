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
    doneCount: 0,
    total: LESSONS.length,
    openIdx: -1
  },

  onLoad() {
    let done = [];
    try { done = wx.getStorageSync(DONE_KEY) || []; } catch (e) {}
    const doneMap = {};
    (done || []).forEach((k) => { doneMap[k] = true; });
    this.setData({ myNote: wx.getStorageSync('hb_eduNote') || '' });
    // 全部学完：每天打开自动出一道温故题
    if (LESSONS.every((l) => doneMap[l.key])) {
      const rk = 'hb_eduReview_' + new Date().toDateString();
      if (!wx.getStorageSync(rk)) { wx.setStorageSync(rk, true); this.rollReview(); }
    }
    // 续学：自动展开第一节还没学完的课（全部学完则收起）
    let openIdx = -1;
    for (let i = 0; i < LESSONS.length; i++) { if (!doneMap[LESSONS[i].key]) { openIdx = i; break; } }
    this.setData({ lessons: LESSONS, doneMap, doneCount: Object.keys(doneMap).length, quizOk: {}, answered: {}, streak: this.calcStreak(), openIdx });
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
      wx.setStorageSync(DARK_KEY, done);
      wx.showToast({ title: '学完一节 🎉', icon: 'success' });
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

  // 随堂小测：答对自动点亮「学完」
  answerQuiz(e) {
    const i = Number(e.currentTarget.dataset.i);
    const o = Number(e.currentTarget.dataset.o);
    const l = this.data.lessons[i];
    if (!l || !l.quiz) return;
    this.markStudyToday();
    const key = l.key;
    const answered = this.data.answered;
    answered[key] = o;
    if (o === l.quiz.ans) {
      const quizOk = this.data.quizOk;
      quizOk[key] = true;
      this.setData({ answered, quizOk, streak: this.calcStreak() });
      let done = wx.getStorageSync(DONE_KEY) || [];
      if (!done.includes(key)) {
        done.push(key);
        wx.setStorageSync(DONE_KEY, done);
        const doneMap = this.data.doneMap;
        doneMap[key] = true;
        this.setData({ doneMap, doneCount: Object.keys(doneMap).length });
      }
      wx.showToast({ title: '答对了，已点亮 🎉', icon: 'success' });
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
    const l = use[Math.floor(Math.random() * use.length)];
    this.setData({ review: { key: l.key, icon: l.icon, title: l.title, quiz: l.quiz, picked: -1, ok: false } });
  },
  answerReview(e) {
    const o = Number(e.currentTarget.dataset.o);
    const rv = this.data.review;
    if (!rv || rv.picked >= 0) return;
    const ok = o === rv.quiz.ans;
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
  saveNote() {
    const t = (this.data.myNote || '').trim();
    wx.setStorageSync('hb_eduNote', t.slice(0, 60));
    wx.showToast({ title: t ? '已记下 🌱' : '已清空', icon: 'none' });
  },

  // 结业卡：全部学完后可复制的一段「结业词」（本地，留念/分享）
  // 复制这一课：分享给朋友 / 转发到班群都方便（纯文本）
  copyLesson(e) {
    const i = Number(e.currentTarget.dataset.i);
    const l = this.data.lessons[i];
    if (!l) return;
    const body = [
      '【心语伴 · 心理小课】' + l.icon + ' ' + l.title,
      l.intro,
      '',
      ...l.points.map((p) => '· ' + p),
      '',
      '💚 今天可以这样做：' + l.do
    ].join('\n');
    wx.setClipboardData({ data: body, success: () => wx.showToast({ title: '已复制这一课', icon: 'success' }) });
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