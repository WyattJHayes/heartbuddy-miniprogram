// pages/helper/helper.js —— 求助中心
const { hotlines } = require('../../config/index');
const { MOOD_SCORE } = require('../../utils/moodscore');
const app = getApp();

// 今日关怀：按当日轮换的轻量贴士（本地生成，无网络依赖）
const CARE_NOTES = [
  { emoji: '🌤', title: '抬头看看天气', text: '无论屏幕外是雨天还是晴，都在提醒你：此刻的真实世界，也会过去的。' },
  { emoji: '💧', title: '喝一杯水', text: '情绪起伏时先照顾身体——喝口水、站起来伸个懒腰，再回来处理事情。' },
  { emoji: '🧘', title: '给自己 3 分钟', text: '去「呼吸练习」页做一轮慢呼吸：吸气 4 秒、停 4 秒、呼气 5 秒。' },
  { emoji: '📝', title: '写下一件小事', text: '今天有没有一件让你感觉好一点的小事？写下来，重复它。' },
  { emoji: '🌳', title: '走到户外去', text: '如果可能，出门走 10 分钟，让光线和风换一换心情。' },
  { emoji: '💬', title: '联系一个"搭子"', text: '给信任的人发条消息，哪怕只是「今天还好吗」，别把情绪闷住。' },
  { emoji: '🌙', title: '今晚早点睡', text: '入睡前 30 分钟放下手机，让大脑慢慢冷却下来。' }
];

// 我撑过来了：5 步自助（剖析 → 行动 → 陪伴 → 收尾）
const SELF_STEPS = [
  { q: '先停一下，说出此刻的感受是什么？（害怕 / 委屈 / 喘不上气…都可以）' },
  { q: '此刻最让你难受的那件事，具体是什么？' },
  { q: '如果现在只能做一件小事让自己好受一点，会是什么？' },
  { q: '如果此刻你信任的人就在身边，你想告诉他“我…”？' },
  { q: '给你自己一句收尾的话（今天你已经很好了）' }
];

Page({
  data: {
    triageDone: false,
    safePeople: '',               // 安全包：可信赖的人称呼（本地）
    askSituations: [              // 开口求助：处境选项（本地生成话术）
      { k: 'sleep',    label: '我最近睡不好' },
      { k: 'anxious',  label: '我很焦虑、静不下心' },
      { k: 'low',      label: '我最近很低落' },
      { k: 'pressure', label: '学习压力快撑不住了' },
      { k: 'talk',     label: '我想找心理老师聊聊' },
      { k: 'bully',    label: '我在学校被欺负了' },
      { k: 'family',   label: '家里总吵架，我很烦' }
    ],
    scriptSituation: '',
    scriptText: '',
    scriptHist: [],     // 最近复制过的话术（本地 ≤3 条，可再复制）
    callLog: [],        // 最近拨打过的热线（本地 ≤5 条）
    careGrad: false,            // 四段陪伴计划走完后的「毕业卡」（一次性）
    safeContacts: [],           // 安全包（升级版）：[{n:'妈妈', p:'138…'}]，支持一键拨打
    hotlines,
    safety: false, // 是否已设置 24 小时回访
    safetyHint: '',
    care: null,      // 今日关怀 { emoji, title, text }
    englishPhrases: [],  // 英文小抄（一键复制）
    // 我撑过来了 5 步
    self: SELF_STEPS,
    selfStep: -1,       // -1=未开始；0-4=进行中
    selfInput: '',
    selfLast: null,     // { date, done } 上次收尾
    selfResumeStep: 0,   // >0 表示有未走完的存档（第几步），可一键接着走
    followCare: null     // 回访关怀卡 { note, dueAt, dueText }
    ,hushCare: false   // 求助后静音关怀：安排回访 3 天内，顶部一条轻量不打扰的卡
    ,smartTip: null      // 智能分流：此刻建议（按时段/连续低情绪天数，轻提示不打扰）
  },

  // ---- 要一句安慰的话：随机温和短句，可记住 / 可复制给自己 ----
  // 现在最需要什么：三选一快速分流（先给出口，不给判断）
  onNeedNav() {
    wx.setStorageSync('hb_triageDone', new Date().toDateString());
    wx.showActionSheet({
      itemList: ['心很乱·停不下来 → 呼吸练习', '闷得慌·想说出来 → 找心语聊聊', '发空·不知道自己要什么 → 随手整理心情'],
      success: (r) => {
        const go = ['/pages/breathe/breathe', '/pages/chat/chat', '/pages/mood/mood'];
        const url = go[r.tapIndex];
        if (url === '/pages/chat/chat' || url === '/pages/mood/mood') wx.switchTab({ url });
        else wx.navigateTo({ url });
      }
    });
  },

  // ---- 开口求助话术生成器（本地模板，可复制发送）----
  pickSituation(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ scriptSituation: k });
    this.regenScript(k);
  },
  regenScript(k) {
    const key = k || this.data.scriptSituation;
    if (!key) return;
    const first = (wx.getStorageSync('hbSafePeople') || '').split('、')[0].trim();
    const call = first && first.length <= 6 ? first : '您';
    const TPL = {
      sleep: [
        `老师/爸妈，想跟您说一件事：我最近入睡很难，躺在床上一两个小时都睡不着，白天上课也很困。我不是偷玩手机，是真的睡不着。想请您陪我想想办法，或者去看看医生。`,
        `跟您说个事：这段时间我总是睡不好，半夜会醒，早上起来很累。我有点撑不住了，想找您聊聊，也想知道要不要寻求专业帮助。`
      ],
      anxious: [
        `${call === '您' ? '老师' : call}，我最近心里总是很慌，静不下心学习，有时候心跳很快、手心出汗。我试着调节过，但没什么用。我想让您知道，也希望有人能帮帮我。`,
        `我想说一件事：最近我总是莫名紧张，考试前尤其严重，脑子里停不下来。我怕一直这样下去，想找您或专业的人聊一聊。`
      ],
      low: [
        `跟您说这些有点难，但我最近情绪一直很低落，对什么都提不起兴趣，有时候觉得撑不下去了。我不想让您担心，但我真的需要有人陪我。`,
        `我最近状态很差，经常想哭，也吃不下饭。我知道这样不对劲，想请您帮帮我，或者带我去看一次心理医生。`
      ],
      pressure: [
        `我最近学习压力特别大，作业和考试排得很满，我感觉快撑不住了。不是我不想努力，是我真的太累了。想跟您商量一下，能不能帮我减掉一点，或者教我怎么安排。`,
        `想跟您坦白：这段时间我一直咬牙撑着，但越撑越焦虑，晚上也睡不好。我怕这样下去会垮掉，希望您能听我说说，帮我一起想想办法。`
      ],
      bully: [
        `老师，我想跟您说一件一直不敢讲的事：我在学校被同学欺负了（起难听的外号/孤立我/抢东西）。我很害怕，也不敢跟家里说。我知道这样下去不行，想请您帮帮我。`,
        `老师，有件事憋了很久：有同学总是针对我，故意弄坏我的东西，还在群里说我坏话。我一个人扛不住了，想请您帮我，也希望这件事能被认真对待。`
      ],
      family: [
        `爸/妈，家里最近总是吵架，我每次听到都很慌，写作业也静不下心。我知道你们可能有自己的难处，但我真的很需要一个安静一点的环境。能不能约定吵架时去阳台说，或者等我不在家的时候说？`,
        `想跟你们说：每次你们吵架，我都会躲进房间很难受。我不是在怪谁，只是希望家里能平和一点。如果可以，我们能不能找个时间一起聊聊这件事。`
      ],
      talk: [
        `老师，我最近心里有些事，一直自己扛着，有点扛不住了。想找您聊一聊，大概需要 20 分钟。如果您这周有时间，请告诉我什么时候方便。`,
        `老师您好，我想预约一次心理谈话。这段时间我情绪不太好，也睡不好，想找专业的人聊聊。您方便的时候回我一下就好。`
      ]
    };
    const arr = TPL[key] || [];
    if (!arr.length) { this.setData({ scriptText: '' }); return; }
    const pick = arr[Math.floor(Math.random() * arr.length)];
    this.setData({ scriptText: pick });
  },
  // 考试季家长贴士：给家长/老师的一段可转发文字（本地静态，帮助沟通）
  copyParentTips() {
    const t = [
      '【考试季，孩子最需要的三句话】',
      '1. 「考成什么样，你都是我们的孩子。」——先把安全感给足，成绩再谈。',
      '2. 「你最近累不累？」——先关心人，再关心分数。',
      '3. 「需要我们怎么帮你？」——把选择权交回给孩子。',
      '',
      '三个「尽量」：尽量保证睡眠 7 小时以上；尽量每天有一顿不谈学习的饭；尽量发现一个与成绩无关的优点并说出口。',
      '如果孩子连续一周以上情绪低落、失眠或说「撑不下去」，请认真对待：联系学校心理老师，或拨打全国心理援助热线 12356（24 小时免费）。',
      '—— 转发自「心语伴」'
    ].join('\n');
    wx.setClipboardData({
      data: t,
      success: () => wx.showToast({ title: '已复制，可发给家长', icon: 'success' })
    });
  },

  copyFriendTips() {
    const t = [
      '【朋友很难受时，我可以这样做】',
      '1. 先听，不急着讲道理：「我在，你说，我不打断。」',
      '2. 别说「想开点」，换成「这确实很难，你难受是正常的」。',
      '3. 可以直接问安全：「你有没有想过伤害自己？」——问不会造成伤害，不问才有风险。',
      '4. 陪 TA 一起找大人：老师、家长或心理老师；你不必独自扛下朋友的生命。',
      '5. 情况紧急立刻拨 12356（24 小时免费），并陪在 TA 身边。',
      '—— 也请照顾好你自己，来自「心语伴」'
    ].join('\n');
    wx.setClipboardData({ data: t, success: () => wx.showToast({ title: '已复制，谢谢你愿意帮 TA', icon: 'success' }) });
  },

  copyHotline(e) {
    const n = e.currentTarget.dataset.n;
    if (!n) return;
    wx.setClipboardData({ data: String(n), success: () => wx.showToast({ title: '号码已复制', icon: 'none' }) });
  },

  pushHist(t) {
    const h = (wx.getStorageSync('hb_scriptHist') || []).filter((x) => x.t !== t);
    h.unshift({ t, time: new Date().toLocaleDateString() });
    wx.setStorageSync('hb_scriptHist', h.slice(0, 3));
    this.setData({ scriptHist: h.slice(0, 3) });
  },
  reCopyHist(e) {
    const t = e.currentTarget.dataset.t;
    if (!t) return;
    wx.setClipboardData({ data: t, success: () => wx.showToast({ title: '已再次复制', icon: 'success' }) });
  },

  editScript() {
    const t = this.data.scriptText;
    if (!t) return;
    wx.showModal({
      title: '改一改再复制',
      content: t,
      editable: true,
      placeholderText: t,
      confirmText: '复制',
      cancelText: '不改了',
      success: (r) => {
        if (!r.confirm) return;
        const out = ((r.content || '').trim()) || t;
        if (!wx.getStorageSync('ach_askOut')) wx.setStorageSync('ach_askOut', true);
        wx.setClipboardData({ data: out, success: () => wx.showToast({ title: '已复制改好的话', icon: 'success' }) });
      }
    });
  },

  copyScript() {
    if (!this.data.scriptText) return;
    wx.setClipboardData({
      data: this.data.scriptText,
      success: () => {
        if (!wx.getStorageSync('ach_askOut')) wx.setStorageSync('ach_askOut', true); // 成就：开口一次
        this.pushHist(this.data.scriptText);
        wx.showToast({ title: '已复制，发给信任的人', icon: 'success' });
      }
    });
  },

  onComfort() {
    const P = [
      '抱撑到现在已经很好了，今天也辛苦啦。',
      '允许自己今天只是「停着」，不用立刻好起来。',
      '你不是一个人，我一直在这里陪着你。',
      '慢慢来，你不需要马上变好。',
      '把此刻先放下，明天再想也不迟。',
      '难受是真实的，但它不会一直这么大。'
    ];
    const t = P[Math.floor(Math.random() * P.length)];
    wx.showModal({
      title: '🌿 先接住这句话',
      content: t,
      confirmText: '记住了',
      cancelText: '复制给自己',
      success: (r) => { if (!r.confirm) wx.setClipboardData({ data: t }); }
    });
  },

  onShow() {
    this.loadFollowUp();
    this.loadHushCare();
    this.loadSmartTip();
    // 当天已用过“方向选择”→ 隐藏（次日恢复）
    this.setData({ triageDone: wx.getStorageSync('hb_triageDone') === new Date().toDateString() });
    // 安全包：预先填写的「可信赖的人」称呼（本地）
    const ppl = wx.getStorageSync('hbSafePeople') || '';
    if (ppl !== this.data.safePeople) this.setData({ safePeople: ppl });
    // 毕业卡：四段陪伴走完且未看过 → 显示一次
    const grad = wx.getStorageSync('hbCareGrad');
    this.setData({ careGrad: !!(grad && !wx.getStorageSync('hbCareGradSeen')) });
    // 安全包（升级版）：兼容旧的纯称呼格式
    this.setData({ safeContacts: this.loadSafeContacts() });
    this.setData({ scriptHist: wx.getStorageSync('hb_scriptHist') || [] });
    this.setData({ callLog: wx.getStorageSync('hb_callLog') || [] });
  },

  // 毕业卡关闭：记住已看，不再打扰
  closeGrad() {
    wx.setStorageSync('hbCareGradSeen', true);
    this.setData({ careGrad: false });
  },
  goEduFromGrad() {
    this.closeGrad();
    wx.navigateTo({ url: '/pages/edu/edu' });
  },

  // 安全包解析：新格式「称呼:电话」、旧格式「称呼」都兼容
  loadSafeContacts() {
    const rawNew = wx.getStorageSync('hbSafeContacts');
    if (Array.isArray(rawNew) && rawNew.length) return rawNew.slice(0, 3);
    const legacy = wx.getStorageSync('hbSafePeople') || '';
    return legacy.split(/[、，,\s]+/).filter(Boolean).slice(0, 3).map((n) => ({ n, p: '' }));
  },
  callSafe(e) {
    const p = e.currentTarget.dataset.p;
    if (!p) { this.editSafePeople(); return; }
    wx.makePhoneCall({ phoneNumber: String(p).replace(/\D/g, ''), fail: () => {} });
  },

  // 安全包：唤起填写/修改「我想让谁记得我」（本地保存 3 人以内）
  editSafePeople() {
    wx.showModal({
      title: '安全包 · 我的求助名单',
      content: '是谁，能在你最难受的时候找到？写 1-3 个，格式「称呼:电话」（电话可留空），危急时可以一键拨打。',
      editable: true,
      placeholderText: '妈妈:138xxxxxxxx、班主任、表姐:139xxxxxxxx',
      confirmText: '保存',
      success: (r) => {
        if (!r.confirm) return;
        const raw = (r.content || '').trim();
        const contacts = raw.split(/[，,、]+/).map((x) => x.trim()).filter(Boolean).slice(0, 3)
          .map((x) => {
            const i = Math.min(x.indexOf(':') >= 0 ? x.indexOf(':') : 9999, x.indexOf('：') >= 0 ? x.indexOf('：') : 9999);
            if (i >= 9999) return { n: x, p: '' };
            return { n: x.slice(0, i).trim(), p: x.slice(i + 1).replace(/\D/g, '') };
          }).filter((c) => c.n);
        wx.setStorageSync('hbSafeContacts', contacts);
        wx.setStorageSync('hbSafePeople', contacts.map((c) => c.n).join('、')); // 兼容旧字段展示
        this.setData({ safePeople: contacts.map((c) => c.n).join('、'), safeContacts: contacts });
        wx.showToast({ title: contacts.length ? '已收进安全包 🌱' : '已清空', icon: 'none' });
      }
    });
  },

  // 智能分流：按时段 + 最近连续低情绪天数，给一条最相关的此刻建议（轻提示条，不打扰）
  async loadSmartTip() {
    let lowStreak = 0;
    try {
      let openid = app.globalData.openid;
      if (!openid) openid = await app.login();
      if (!openid) return;
      const db = wx.cloud.database();
      const r = await db.collection('moods').where({ openid }).orderBy('createdAt', 'desc').limit(30).get();
      // 只保留最近 7 天的「每日最低分」（一天多条取当天最低，最能反映低情绪）
      const dayLow = new Map();
      const DAY = 86400000;
      const now0 = new Date(); now0.setHours(0, 0, 0, 0);
      (r.data || []).forEach((m) => {
        const d = new Date(m.createdAt);
        d.setHours(0, 0, 0, 0);
        if (now0 - d > 6 * DAY) return;
        const k = d.getTime();
        const sc = MOOD_SCORE[m.mood];
        if (sc === undefined) return;
        dayLow.set(k, Math.min(dayLow.has(k) ? dayLow.get(k) : 5, sc));
      });
      // 从今天（无记录则从昨天）往过去数连续低分天数
      const ks = Array.from(dayLow.keys()).sort((a, b) => b - a);
      let cursor = now0.getTime();
      ks.forEach((k) => {
        if (k <= cursor) {
          if (dayLow.get(k) < 3.5) lowStreak += 1;
          else lowStreak = 0;
          cursor = k - DAY;
        }
      });
    } catch (e) { /* 不影响页面 */ }

    const hour = new Date().getHours();
    let tip = null;
    if (hour >= 22 || hour < 6) {
      tip = { emoji: '🌙', title: '深夜里，别独自硬扛', text: '先做 3 分钟呼吸，或去「写给自己一句」把心事放下来；撑不住时，点上方热线号码。' };
    } else if (lowStreak >= 3) {
      tip = { emoji: '💙', title: `连续 ${lowStreak} 天有点低`, text: '辛苦了。先喝口水、慢慢呼吸；也可以把最近的事说给我听，或先打给热线喘口气。' };
    } else if (lowStreak >= 2) {
      tip = { emoji: '🌱', title: '最近两天不太稳', text: '试试下方「呼吸练习」3 分钟，或直接戳一个信任的人聊聊，别一个人扛。' };
    } else if (hour < 11) {
      tip = { emoji: '🌤', title: '早上的你，值得被温柔以待', text: '今天从喝一杯水开始。如果心里闷，「我撑过来了」5 步自助也许能帮你理一理。' };
    } else {
      tip = { emoji: '🧭', title: '先把眼前的一小步走好', text: '此刻不舒服的话，先做 3 分钟呼吸；需要人陪，也可以先在聊天里找我。' };
    }
    this.setData({ smartTip: tip });
  },

  // 求助后静音关怀：安排回访 3 天内，顶部显示一条轻量关怀卡（不弹窗、可关闭、当天不再显示）
  loadHushCare() {
    try {
      const seen = wx.getStorageSync('helperHushSeen') || '';
      if (seen === new Date().toDateString()) { this.setData({ hushCare: false }); return; }
      const ok = wx.getStorageSync('crisisCheck');
      if (!ok) { this.setData({ hushCare: false }); return; }
      const wentAt = ok - 24 * 3600 * 1000; // 回安排时间（crisisCheck=到期时刻，减去 24h）
      if (Date.now() - wentAt > 3 * 86400000) { this.setData({ hushCare: false }); return; }
      this.setData({ hushCare: true });
    } catch (e) {
      this.setData({ hushCare: false });
    }
  },

  closeHushCare() {
    try { wx.setStorageSync('helperHushSeen', new Date().toDateString()); } catch (e) {}
    this.setData({ hushCare: false });
  },

  // 回访关怀卡：读取 followUps 最近一条「待回访」记录（到期未超 3 天），展示给用户
  async loadFollowUp() {
    try {
      let openid = this._app ? this._app.globalData.openid : '';
      if (!openid) {
        this._app = getApp();
        openid = this._app && this._app.globalData.openid;
      }
      if (!openid) return;
      const db = wx.cloud.database();
      const _ = db.command;
      const res = await db.collection('followUps')
        .where({ openid, status: 'open', dueAt: _.gte(Date.now() - 3 * 86400000) })
        .orderBy('dueAt', 'asc')
        .limit(1)
        .get()
        .catch(() => ({ data: [] }));
      const f = (res.data || [])[0];
      if (!f) { this.setData({ followCare: null }); return; }
      const remain = f.dueAt - Date.now();
      const dueText = remain > 0
        ? (remain > 86400000 ? `${Math.ceil(remain / 86400000)} 天内` : `${Math.max(1, Math.ceil(remain / 3600000))} 小时内`)
        : '正在进行中';
      this.setData({ followCare: { note: f.note || '我想回来看看你', dueAt: f.dueAt, dueText } });
    } catch (e) {
      // 无权限/网络异常时静默隐藏，不影响求助页
      this.setData({ followCare: null });
    }
  },

  onLoad() {
    const t = wx.getStorageSync('crisisCheck');
    if (t && t > Date.now()) this.setData({ safety: true });
    // 五步自助：恢复 3 天内未走完的存档（记住走到第几步、写过的答案）
    const prog = wx.getStorageSync('selfCareProgress');
    if (prog && prog.step >= 0 && prog.step < 4 && Date.now() - (prog.ts || 0) < 3 * 86400000) {
      this._resume = prog;
      this.setData({ selfResumeStep: prog.step + 1 });
    } else if (prog) {
      wx.removeStorageSync('selfCareProgress'); // 过期存档清掉
    }
    // 今日关怀：按「年内第几天」取一条日轮换，另加一句时间文案
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
    const note = CARE_NOTES[dayOfYear % CARE_NOTES.length];
    const hour = today.getHours();
    const moment = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    this.setData({
      care: {
        emoji: note.emoji,
        title: `${moment} · ${note.title}`,
        text: note.text
      },
      englishPhrases: [
        { en: "I've been feeling really anxious lately.", zh: '我最近一直很焦虑。' },
        { en: "I can't fall asleep, my mind keeps racing.", zh: '我睡不着，脑子停不下来。' },
        { en: "I feel lonely tonight.", zh: '今晚我好孤独。' },
        { en: "I'm so tired and sad today.", zh: '我今天又累又难过。' },
        { en: "I'm proud of myself for making it through.", zh: '我为撑过来的自己感到骄傲。' },
        { en: "I need to hear something gentle right now.", zh: '现在我想听一句温柔的话。' }
      ]
    });
  },

  // 复制英文句子 → 回聊天粘贴即可（英文小抄）
  copyEn(e) {
    const en = e.currentTarget.dataset.en;
    if (!en) return;
    wx.setClipboardData({
      data: en,
      success: () => wx.showToast({ title: '已复制，去聊天粘贴 🌱', icon: 'none' })
    });
  },

  // 复制「向信任的人求助」的短信模板（脱敏、可直接发）
  copyHelpSms() {
    const text = ['你好，我需要认真地跟你说一件事。',
      '最近一段时间我的情绪一直很低落，晚上也总睡不好，一个人的时候特别难受，偶尔会想到更坏的结果。',
      '我知道不该一个人硬扛，所以决定告诉你。',
      '我不要求你立刻解决什么，只想让你知道我在经历这些。如果可以，能不能陪我坐一会儿，或者帮我想办法——比如陪我去学校的心理中心，或者找专业的医生聊一聊。',
      '很感谢你愿意听我说到这里。',
      '（这是「心语伴」提供的一段参考文字，你可以按自己的情况改一改）'].join('\n');
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制，发给信任的人吧', icon: 'none' })
    });
  },

  call(e) {
    const number = e.currentTarget.dataset.number;
    if (!number) return;
    // 记下拨打史（本地 ≤5 条）：回来后能看到自己曾为自己迈出过这一步
    const name = e.currentTarget.dataset.name || '热线';
    const log = wx.getStorageSync('hb_callLog') || [];
    log.unshift({ name, number, time: Date.now() });
    wx.setStorageSync('hb_callLog', log.slice(0, 5));
    this.setData({ callLog: log.slice(0, 5) });
    wx.makePhoneCall({ phoneNumber: number, fail: () => {} });
  },

  goBreathe() {
    wx.navigateTo({ url: '/pages/breathe/breathe' });
  },

  goScan() {
    wx.navigateTo({ url: '/pages/scan/scan' });
  },

  goStation() {
    wx.navigateTo({ url: '/pages/station/station' });
  },

  // 已安全回执：安排「温暖陪伴计划」——1 小时后 / 1 天 / 3 天 / 7 天，在陪伴页分阶段轻声回访
  checkSafe() {
    wx.showModal({
      title: '安排温柔回访',
      content: '心语会分四次来找你：1 小时后问问你现在好不好、一天后、三天后、还有七天后。像一位在后面陪着你走的朋友。可以吗？',
      confirmText: '好的',
      success: (r) => {
        if (!r.confirm) return;
        const now = Date.now();
        const H = 3600 * 1000;
        const plan = [{ t: now + 1 * H, s: 0 }, { t: now + 24 * H, s: 1 }, { t: now + 3 * 24 * H, s: 2 }, { t: now + 7 * 24 * H, s: 3 }];
        wx.setStorageSync('hbCarePlan', plan);
        if (!wx.getStorageSync('ach_care')) wx.setStorageSync('ach_care', true); // 成就：也请心语陪我
        this.setData({ safety: true });
        wx.showToast({ title: '已安排 4 次回访 🌱', icon: 'success' });
      }
    });
  },

  // ---- 我撑过来了：5 步自助 ----
  selfStart() {
    wx.removeStorageSync('selfCareProgress'); // 重新开始 = 放弃旧存档
    this._resume = null;
    this.setData({ selfStep: 0, selfInput: '', selfAnswers: [], selfResumeStep: 0 });
  },

  // 接着上次的存档继续走（答案原样带回）
  selfResume() {
    const p = this._resume;
    if (!p) return;
    this.setData({ selfStep: p.step, selfInput: p.input || '', selfAnswers: p.answers || [] });
  },

  onSelfInput(e) {
    this.setData({ selfInput: e.detail.value });
  },

  // 收起：界面归位，但存档保留，下次进来还能接着走
  selfClose() {
    this.setData({ selfStep: -1, selfInput: '', selfAnswers: [] });
    if (wx.getStorageSync('selfCareProgress')) {
      wx.showToast({ title: '已存档，下次接着走 🌱', icon: 'none' });
    }
  },

  selfNext() {
    const answers = this.data.selfAnswers || [];
    answers.push((this.data.selfInput || '').trim());
    if (this.data.selfStep < 4) {
      const next = this.data.selfStep + 1;
      this.setData({ selfStep: next, selfInput: '', selfAnswers: answers });
      // 每走一步都存档（step=下一步待填，answers=已答）
      wx.setStorageSync('selfCareProgress', { step: next, answers, input: '', ts: Date.now() });
    } else {
      // 完成：收尾存本地，清掉进度存档，轻轻给一句肯定
      const d = new Date();
      const pad = (n) => (n < 10 ? '0' + n : n);
      const last = {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        done: answers[answers.length - 1] || '（没想好也没关系，今天就先到这里）'
      };
      const hist = wx.getStorageSync('selfCareLog') || [];
      hist.push(last);
      if (hist.length > 5) hist.shift();
      wx.setStorageSync('selfCareLog', hist);
      wx.removeStorageSync('selfCareProgress');
      this._resume = null;
      this.setData({ selfStep: -1, selfInput: '', selfAnswers: [], selfLast: last, selfResumeStep: 0 });
      wx.showToast({ title: '收尾成功，辛苦了 🌱', icon: 'none' });
    }
  },

  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); }
});