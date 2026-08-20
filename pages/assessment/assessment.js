// pages/assessment/assessment.js —— 考前焦虑自评（GAD-7 风格，题目自编）
const app = getApp();

const QUESTIONS = [
  '过去两周，我经常感到紧张、焦虑或提心吊胆',
  '我很难停止或控制自己的担忧',
  '我对各种事情都担心得过多',
  '我很难放松下来',
  '我因为着急而不停来回走动或坐立不安',
  '我变得容易心烦或容易被激怒',
  '我总感觉会有可怕的事情要发生'
];

const LEVELS = [
  { max: 4, label: '低','text': '你的状态整体还好，继续保持规律作息，考前适当休息。' },
  { max: 11, label: '中度', text: '你有一定程度的焦虑，试着把压力拆小、写下来，每天做 5 分钟深呼吸。' },
  { max: 21, label: '偏高', text: '这份感受需要被认真看见，建议和家人/老师说说，或看看「求助」页的热线。' }
];

Page({
  data: {
    questions: QUESTIONS,
    cur: 0,          // 当前第几题（0 起）
    answers: [],     // 每题得分
    done: false,
    total: 0,
    levelLabel: '',
    advice: '',
    submitting: false
  },

  onLoad() {
    this.setData({ answers: QUESTIONS.map(() => null) });
  },

  pick(e) {
    const idx = this.data.cur;
    const score = Number(e.currentTarget.dataset.score);
    const answers = this.data.answers;
    answers[idx] = score;
    if (idx < QUESTIONS.length - 1) {
      this.setData({ answers, cur: idx + 1 });
    } else {
      this.submit(answers);
    }
  },

  prev() {
    if (this.data.cur > 0) this.setData({ cur: this.data.cur - 1 });
  },

  async submit(answers) {
    const total = answers.reduce((a, b) => a + b, 0);
    const lv = total <= 4 ? LEVELS[0] : total <= 11 ? LEVELS[1] : LEVELS[2];

    this.setData({ done: true, total, label: lv.label, advice: lv.text, submitting: true });

    // 落库（复用 openid）+ 写入本地，供对话页把结果带入 AI 上下文
    try {
      let openid = app.globalData.openid;
      if (!openid) openid = await app.login();
      const db = wx.cloud.database();
      await db.collection('assessments').add({
        data: { openid, name: '考前焦虑自评', total, level: lv.label, items: answers, createdAt: Date.now() }
      });
      wx.setStorageSync('lastAssessment', { total, label: lv.label, ts: Date.now() });
    } catch (e) { console.error('[assessment] 落库失败', e); }

    this.setData({ submitting: false });
  },

  restart() {
    this.setData({ done: false, cur: 0, answers: QUESTIONS.map(() => null), total: 0 });
  },

  goHelper() { wx.switchTab({ url: '/pages/helper/helper' }); },
  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); }
});