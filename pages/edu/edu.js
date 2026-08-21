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

Page({
  data: {
    lessons: [],
    doneMap: {},   // key -> true
    quizOk: {},    // key -> 随堂小测已答对
    answered: {},  // key -> 已选的选项下标
    doneCount: 0,
    total: LESSONS.length,
    openIdx: -1
  },

  onLoad() {
    let done = [];
    try { done = wx.getStorageSync(DONE_KEY) || []; } catch (e) {}
    const doneMap = {};
    (done || []).forEach((k) => { doneMap[k] = true; });
    this.setData({ lessons: LESSONS, doneMap, doneCount: Object.keys(doneMap).length, quizOk: {}, answered: {} });
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

  // 随堂小测：答对自动点亮「学完」
  answerQuiz(e) {
    const i = Number(e.currentTarget.dataset.i);
    const o = Number(e.currentTarget.dataset.o);
    const l = this.data.lessons[i];
    if (!l || !l.quiz) return;
    const key = l.key;
    const answered = this.data.answered;
    answered[key] = o;
    if (o === l.quiz.ans) {
      const quizOk = this.data.quizOk;
      quizOk[key] = true;
      this.setData({ answered, quizOk });
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

  callHotline() {
    wx.makePhoneCall({ phoneNumber: '12356', fail: () => {} });
  }
});