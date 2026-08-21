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

const Q_SHORT = ['紧张担忧', '难以止住担忧', '担心过度', '难以放松', '坐立不安', '易被激怒', '害怕坏事发生'];

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
    planAllDone: false,
    hist: [],          // 历次自评趋势 [{date,total,level,items}]
    trendText: '',     // 顶部温和趋势提醒（≥2 次历史才显示）
    histDelta: '',     // 与最近一次对比文案
    topWeakText: '',  // 历史最常困扰的 1-2 题
    improveText: '',  // 正在变好的 1-2 题
    lastDays: null,   // 距上次测评天数（≥3 天显示「复测」提示）
    retestRemind: false, // 3 天复查提醒：已设置 or 到期
    retestDue: false,      // 复查是否已到期（到期 → pink 强调 + 立即重测）
  },

  onLoad() {
    this.setData({ answers: QUESTIONS.map(() => null) });
    this.refreshPlan();
    this.loadHistory();
    this.checkLastGap();
    this._checkRetestDue();
  },

  // 复查到期检查：预约时间到了，首页横幅提示并允许立即重测
  _checkRetestDue() {
    const at = wx.getStorageSync('hb_retest_at') || 0;
    if (at && Date.now() >= at) this.setData({ retestRemind: true, retestDue: true });
  },

  // 距上次测评 ≥3 天 → 顶部轻提示条（可一键开始新一次）
  checkLastGap() {
    try {
      const last = wx.getStorageSync('lastAssessment');
      if (!last || !last.ts) return;
      const days = Math.floor((Date.now() - last.ts) / 86400000);
      if (days >= 3) this.setData({ lastDays: days });
    } catch (e) { /* 不影响 */ }
  },

  // 一键复测：回到第一题重新作答（保留历史）
  restartTest() {
    wx.showModal({
      title: '开始新一轮自评？',
      content: '会重新回答 7 题（约 3 分钟），历史上的测评会保留，方便对比趋势。',
      confirmText: '开始',
      success: (r) => {
        if (!r.confirm) return;
        this.setData({ cur: 0, answers: QUESTIONS.map(() => null), done: false, total: 0, lastDays: null });
      }
    });
  },

  // 结果页轻引导：去情绪充电站缓一缓
  goStation() {
    wx.navigateTo({ url: '/pages/station/station' });
  },

  // 自评历史：取本人最近 6 次（高分=焦虑高）→ 看变化趋势
  async loadHistory() {
    try {
      let openid = app.globalData.openid;
      if (!openid) openid = await app.login();
      if (!openid) return;
      const db = wx.cloud.database();
      const res = await db.collection('assessments')
        .where({ openid })
        .orderBy('createdAt', 'desc')
        .limit(6)
        .get();
      const list = (res.data || []).map((a) => ({
        date: this.fmt(a.createdAt),
        total: a.total,
        level: a.level || '—',
        items: Array.isArray(a.items) ? a.items.slice(0, 7) : []
      }));
      let histDelta = '';
      let trendText = '';
      if (list.length >= 2 && typeof list[0].total === 'number' && typeof list[1].total === 'number') {
        const d = list[0].total - list[1].total;
        histDelta = d < 0 ? `较上次低 ${-d} 分，焦虑在回落 👍` : d > 0 ? `较上次高 ${d} 分，建议多关注自己` : '与上次持平，保持关注';
        // 结果页顶部温和趋势提醒（不足 2 次不显示）
        trendText = d < 0
          ? `比上次低了 ${-d} 分，焦虑在回落，做到了就用力夸夸自己 🌈`
          : d > 0
            ? `这次比上次高了 ${d} 分，可能最近压力有点大——先做 3 分钟呼吸，别急 🌿`
            : '和上次分数一样，说明状态稳定，继续保持觉察就好 😌';
      }
      // 逐题洞察：历史每题均值 → 最常困扰 vs 正在变好
      let topWeakText = '';
      let improveText = '';
      const withItems = list.filter((x) => x.items.length === 7);
      if (withItems.length >= 2) {
        const means = [];
        for (let q = 0; q < 7; q++) {
          const nums = withItems.map((x) => Number(x.items[q])).filter((v) => !Number.isNaN(v));
          means.push(nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
        }
        const order = means.map((m, q) => ({ m, q })).sort((a, b) => b.m - a.m);
        const weak = order.filter((o) => o.m >= 0.5).slice(0, 2).map((o) => Q_SHORT[o.q]);
        if (weak) topWeakText = weak.join(' · ');
        // 与最近一次对比：哪些题比自己的历史均值低得最多（在变好）
        const last = withItems[0].items;
        const gains = means.map((m, q) => m - Number(last[q])).filter((v) => !Number.isNaN(v));
        const best = gains.map((g, q) => ({ g, q })).sort((a, b) => b.g - a.g);
        const imp = best.filter((o) => o.g > 0).slice(0, 2).map((o) => Q_SHORT[o.q]);
        if (imp.length) improveText = `在改善：${imp.join('、')}`;
      }
      this.setData({ hist: list, histDelta, trendText, topWeakText, improveText });
    } catch (err) {
      console.warn('[assessment] 历史读取失败', err);
    }
  },

  fmt(ts) {
    const d = new Date(ts);
    const p = (x) => (x < 10 ? '0' + x : x);
    return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
      // 复查到期：预约时间已到 → 显示「复查时间到了」横幅
      const dueAt = wx.getStorageSync('hb_retest_at') || 0;
      if (dueAt && Date.now() >= dueAt) {
        this.setData({ retestRemind: true, retestDue: true });
        wx.setStorageSync('hb_retest_done', true);
      }
    } catch (e) { console.error('[assessment] 落库失败', e); }

    this.setData({ submitting: false });
  },

  // 复查提醒：本地存一个 3 天后的时间，重开自评页时检查
  setRetestRemind() {
    const at = Date.now() + 3 * 24 * 3600 * 1000;
    wx.setStorageSync('hb_retest_at', at);
    wx.setStorageSync('hb_retest_done', false);
    this.setData({ retestRemind: true, retestDue: false });
    wx.showToast({ title: '已设 3 天后复查提醒', icon: 'success' });
  },

  restart() {
    this.setData({ done: false, cur: 0, answers: QUESTIONS.map(() => null), total: 0 });
  },

  // 分享给信任的人：脱敏温和文字（不含分数与题目细节），复制后自行粘贴发送
  shareTrusted() {
    const T = {
      '低': '想跟你说件小事：我最近给自己做了个状态小盘点，整体还不错。只是考前这段时间，还是希望你能多陪陪我——晚饭后一起散散步、或随口问问我今天怎么样，就很好了。',
      '中度': '想跟你坦白一件事：我最近给自己做了个状态小盘点，发现焦虑比表现出来的多一点。跟你说是因为我信任你。这几天能不能偶尔回来看看我、或陪我十分钟说说话？对我真的有帮助。',
      '偏高': '有件事想认真告诉你：我最近的状态比自己表现出来的要吃力一些，一个人撑着有点难。我很需要你——这几天能不能多留意我一下？如果方便，我也想找你当面聊一聊。'
    };
    const text = (T[this.data.label] || T['低']) + '\n（这段话由「心语伴」生成，我读过了才发给你 🌱）';
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制，发给 TA 吧', icon: 'none' })
    });
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