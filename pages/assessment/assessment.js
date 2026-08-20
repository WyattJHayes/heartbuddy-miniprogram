// pages/assessment/assessment.js —— 考前焦虑自评（GAD-7 风格，题目自编）
const app = getApp();
const planlib = require('../../utils/plan');

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
    submitting: false,
    showCard: false,  // 应对卡浮层
    cardUrl: '',
    drawing: false,
    plan: null,       // 3 天陪伴计划（本地）
    planIdx: -1,
    planAllDone: false
  },

  onLoad() {
    this.setData({ answers: QUESTIONS.map(() => null) });
    this.refreshPlan();
  },

  refreshPlan() {
    const p = planlib.load();
    if (!p) this.setData({ plan: null });
    else this.setData({ plan: p, planIdx: planlib.activeIndex(p), planAllDone: planlib.activeIndex(p) >= p.days.length });
  },

  startPlan() {
    const p = planlib.build(this.data.label || '低');
    wx.setStorageSync('companionPlan', p);
    this.refreshPlan();
    wx.showToast({ title: '计划已生成，去心情页查看', icon: 'none' });
  },

  toggleDay(e) {
    const i = Number(e.currentTarget.dataset.i);
    const p = this.data.plan;
    if (!p || i !== this.data.planIdx) return; // 只能打卡“今天”那一天
    p.done[i] = !p.done[i];
    wx.setStorageSync('companionPlan', p);
    this.refreshPlan();
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
      wx.setStorageSync('ach_assess', true); // 成就：认识自己
    } catch (e) { console.error('[assessment] 落库失败', e); }

    this.setData({ submitting: false });
  },

  restart() {
    this.setData({ done: false, cur: 0, answers: QUESTIONS.map(() => null), total: 0 });
  },

  // ---- 考前焦虑应对卡（Canvas 2D 绘制，可保存到相册） ----
  openCard() {
    if (this.data.drawing) return;
    this.setData({ showCard: true });
    wx.nextTick(() => this.drawCardCanvas());
  },

  closeCard() {
    if (this.data.drawing) return; // 绘制中禁止关闭，避免保存到空画布
    this.setData({ showCard: false, cardUrl: '' });
  },

  noop() {},

  async drawCardCanvas() {
    if (this.data.drawing) return;
    this.setData({ drawing: true });
    try {
      const res = await new Promise((ok, err) => {
        this.createSelectorQuery()
          .select('#cardCanvas')
          .fields({ node: true, size: true })
          .exec((r) => (r && r[0] && r[0].node ? ok(r[0]) : err(new Error('canvas 未就绪'))));
      });
      const { node, size } = res;
      const dpr = (wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2) || 2;
      const W = size.width;
      const H = size.height;
      node.width = Math.round(W * dpr);
      node.height = Math.round(H * dpr);
      const ctx = node.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      // 背景
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#edf3ff');
      bg.addColorStop(1, '#ffffff');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#5b8def';
      ctx.fillRect(0, 0, W, 10);

      // 标题
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2b3a5e';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('考前焦虑应对卡', W / 2, 66);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#7b88a2';
      ctx.fillText('心语伴 · 自评结果备忘（仅供自评参考）', W / 2, 96);

      // 结果
      const emoji = this.data.total <= 4 ? '🌤' : this.data.total <= 11 ? '🌥' : '⛈';
      ctx.font = '42px sans-serif';
      ctx.fillText(emoji, W / 2, 152);
      ctx.font = 'bold 21px sans-serif';
      ctx.fillStyle = '#3e5ba3';
      ctx.fillText(`焦虑水平：${this.data.label} · 得分 ${this.data.total}/21`, W / 2, 196);
      ctx.strokeStyle = '#ffd8b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(34, 218);
      ctx.lineTo(W - 34, 218);
      ctx.stroke();

      // 正文（自动换行）
      let y = 246;
      ctx.textAlign = 'left';
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#44506b';
      y = this.wrapped('给你的话：' + this.data.advice, ctx, W - 70, 5, 26, y) + 14;
      const tips = [
        '每天抽 3 分钟慢呼吸：吸气 4 秒、屏住 4 秒、呼气 6 秒',
        '把担心写下来，塞进“今晚再慢慢拆”的盒子里',
        '睡前一小时放下手机，听点轻音乐或者出去走走',
        '记住：焦虑是在准备你，不是你在失败'
      ];
      for (const t of tips) {
        y = this.wrappedText('· ' + t, ctx, W - 70, 3, 26, y) + 16;
      }

      // 页脚
      ctx.textAlign = 'center';
      ctx.fillStyle = '#a9b4c8';
      ctx.font = '13px sans-serif';
      ctx.fillText('紧急时刻请优先联系身边人或拨打 12356 心理援助热线', W / 2, H - 24);

      const cardUrl = await new Promise((ok, err) => {
        wx.canvasToTempFilePath({ canvas: node, success: (r2) => ok(r2.tempFilePath), fail: err }, this);
      });
      this.setData({ cardUrl });
    } catch (e) {
      console.error('[assessment] 应对卡绘制失败', e);
      this.setData({ showCard: false, cardUrl: '' });
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    } finally {
      this.setData({ drawing: false });
    }
  },

  // 按宽度换行绘制；超出 maxLines 截断。返回下一行起始 y。
  wrappedText(text, ctx, maxW, maxLines, lineH, startY) {
    const chars = String(text).split('');
    let line = '';
    let y = startY;
    let lines = 0;
    for (const ch of chars) {
      if (line && ctx.measureText(line + ch).width > maxW) {
        ctx.fillText(line, 34, y);
        y += lineH;
        lines += 1;
        if (lines >= maxLines) {
          ctx.fillText('…', 34, y);
          return y + lineH;
        }
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) {
      ctx.fillText(line, 34, y);
      y += lineH;
    }
    return y;
  },

  saveCardImg() {
    if (!this.data.cardUrl) {
      this.drawCardCanvas();
      return;
    }
    wx.saveImageToPhotosAlbum({
      filePath: this.data.cardUrl,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (e) => {
        if (e && e.errMsg && e.errMsg.indexOf('auth') > -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存图片，然后重试。',
            confirmText: '去设置',
            success: (r) => { if (r.confirm) wx.openSetting(); }
          });
        } else {
          wx.showToast({ title: '保存失败，请重试', icon: 'none' });
        }
      }
    });
  },

  goHelper() { wx.switchTab({ url: '/pages/helper/helper' }); },
  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); }
});