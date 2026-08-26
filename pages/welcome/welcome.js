// pages/welcome/welcome.js —— 隐私同意 & AI 使用说明
const app = getApp();
const { dailyQuotes } = require('../../config/index');

// 星期特别句：给一周的节奏一点柔和的锚（0=周日…6=周六）
const WEEK_LINE = [
  '周日的晚上，适合把这一周轻轻放下，也为你下一周留个位置 🌙',
  '周一的早上，不用急着「打满鸡血」——把今天过好，就已经赢了一场。',
  '周二的你，可能已经被作业追着跑——停 10 秒，喝口水，别让「赶」变成常态。',
  '周三到了，一周过半。今天如果累，就只做「最重要的一件事」。',
  '周四想偷懒？那不是堕落，是身体在替你说「需要休息」。',
  '周五了，先把周五的自己收好，再谈周末：今天也请准时下班。',
  '周六的午后，做什么都好，不做什么也好——周末本来就是你的。'
];

// 今日一句（日轮换，与 chat/充电站同源）
function todayLine() {
  const d = new Date();
  return dailyQuotes[(d.getDate() + d.getMonth()) % dailyQuotes.length] || '';
}

// 今日一句换一句：不喜欢就重抽一条（避开当前这句）
function anotherTodayLine(notThis) {
  if (!Array.isArray(dailyQuotes) || dailyQuotes.length < 2) return '';
  let t = '';
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    t = dailyQuotes[Math.floor(Math.random() * dailyQuotes.length)] || '';
    if (t && t !== notThis) break;
  }
  return t;
}

// 谁在用：不同身份给一句更贴的话（仅展示文案，不影响功能）
const ROLE_HINT = {
  student: '备考、同学关系、考前的慌——这些我熟，随时来聊。',
  teacher: '想帮学生，又怕说错话——可以来这里看看「如果学生找我，我该说什么」。',
  parent: '孩子反复提到考试压力？这里的孩子视角工具也许能帮上忙。',
  other: '我是 AI 陪伴者，你怎么舒服就怎么用。'
};

Page({
  data: {
    loading: true, openid: '', showNotice: false, shared: false, welcomed: true, showLog: false,
    openCount: 0,  // 陪伴次数（第 N 次回来）
    todayLine: '',
    timeGreet: '',   // 按时段问候（早上好/深夜好…）
    goldenSaved: false,
    examCountdown: '',
    weekGreet: '',  // 星期特别句（随当天）
    goldenLine: '', // 我的金句：小课存下的，每天换一条
    weekPlan: '',   // 写给下周的一句话（周日留/周一看起）
    examWrap: null,  // 考完当天傍晚的收尾卡
    preExam: null,   // 考前第 N 天
    afterword: '',  // 考后归位：写一句（考完 1-3 天）
    afterSaved: false,  // 考后已归位
    weekPlanSet: false, // 本周是否已写
    todayCare: null,   // 今日状态卡：今天对自己照顾了什么（呼吸/记录/小事）
    role: '',          // 谁在用：student/teacher/parent/other（本地记住）
    roleTip: '',
    lastRoute: '',  // 继续上次：最近离开的功能页路径
    lastLabel: '',  // 继续上次的按钮文案
    changelog: [
      { v: '2.30', t: '考试倒计时；今日一句换一句；聊后状态趋势；周充电小结；心得导出全部；撑过天数徽章' },
      { v: '2.29', t: '今日一句收进金句墙；身份显示与切换；抽卡一键收藏；周报今日速览；呼吸每日引导语；学习心得回看' },
      { v: '2.28', t: '安全包速览+心情档案导出；扫描后伸展建议；聊天表情条；学习心法；复习提醒' },
      { v: '2.27', t: '三件小事回看；按时段问候；金句墙；抽卡历史；今天我也撑过来了；快评标⚡进历史' },
      { v: '2.26', t: '聊天状态打分+这句没帮到我；呼吸近7天日历；心情最平静的一天；常用语管理；充电站大字模式' },
      { v: '2.25', t: '充电站第27卡反刍思维；深夜安全包提醒；聊天今日一问；收藏卡一键分享；今日一句拿去聊聊；考试早晨出门呼吸' },
      { v: '2.24', t: '充电站第25/26卡(落地&三栏担心)；心情页快乐菜单；小课备考小助手；周报考试得分记录+睡眠小账本' },
      { v: '2.23', t: '自评3题快评；求助页常见8问+给家长/老师的小抄；考完归位一句话；充电站按最近心情推荐；晚间收个尾' },
      { v: '2.22', t: '考完的傍晚收尾卡；专注25分番茄钟；心情页照顾自己的证据；老师家长视角起手；考前7天每天一点点；一封写给自己曰信' },
      { v: '2.21', t: '欢迎页星期特别句；呼吸球随阶段变色；午休小憩20分钟；小课「我的金句」欢迎页日晒；写给下周的自己；考前3分钟静默准备' },
      { v: '2.20', t: '聊天留个提醒(10/30/60分钟)；欢迎页今日滋养三连；考试当天早晨5步；呼吸脸松了没；站第24卡我允许自己8个许可；心情今天放空' },
      { v: '2.19', t: '呼吸紧张急救60秒；聊天考后话题(等结果/对答案)；给我的朋友一句鼓励；周报考试期前后对比；欢迎页本周照顾小结；自评一键复制小结' },
      { v: '2.18', t: '聊天长按AI消息并入常用语；呼吸晨起唤醒3-1-5；扫描近7天身体日历；心情回暖纪念日；说给爸妈听；充电站卡片「去做」' },
      { v: '2.17', t: '充电站第22/23卡(藏住情绪/朋友闹别扭)；心情日历给这天打记号(考试/生日/重要)；聊天一句放下；小课考前N天；陪伴纪念日(第10/25/50/100次)' },
      { v: '2.16', t: '充电站第20/21卡(拖延急救/考后空落)；呼吸把这一刻说给别人；扫描存书签；小课学完一句回应；欢迎页今日状态可点直达；扫描今天身体最需要什么；月报本月情绪亮点' },
      { v: '2.15', t: '聊天此刻我需要(听/陪/办法)；我的导出本地数据；清晨回访；心情对过去某天说一句；欢迎页谁在用；充电站第19卡考前夜' },
      { v: '2.14', t: '求助页给心语一句建议；聊天留下一句便签；呼吸这一轮留给谁；我的便签本回看；扫描先选部位；欢迎页今日状态卡' },
      { v: '2.13', t: '充电站新增「过山车/刷手机」两卡；呼吸课间1.5分钟档；扫描记住上次档位；自评逐题轻反馈；欢迎页继续上次' },
      { v: '2.12', t: '扫描1分钟微扫；呼吸节律轻震动；我的徽章墙成图；聊天主题起手；心情页本月晴雨表；深夜收尾陪伴' },
      { v: '2.11', t: '心理小课今日轻目标；呼吸此刻心意；给下个月的我一句；充电站一句话速读；聊天晚安收尾；心情日历冷暖色' },
      { v: '2.10', t: '自评回看可给那次的自己留言；聊天「谢谢你」快捷；扫描回响卡；担忧交给明天；扫描本周计数；充电站收藏抽屉' },
      { v: '2.9', t: '考前倒计时；每日轻声提醒；充电站「一起充电」；呼吸再来一轮；近四周周几印象；今日充电计数' },
      { v: '2.8', t: '充电站搜索；深夜「睡不着」四路口；欢迎页版本透明；全年心情小结；呼吸回响可复制' },
      { v: '2.7', t: '隐私政策可复制全文；欢迎页快去呼吸；充电站第16张卡「等结果的日子」；今日一句可分享；自评历史可回看逐题答案' },
      { v: '2.6', t: '欢迎页每日一句；数据足迹双行(心情+练习)；三件小事一键填满；达标后再练加一句；深夜写明日三件小事自动带回' },
      { v: '2.5', t: '呼吸完成带今日进度；扫描补今晚次数；月报补最长连续记录；温故连 7 天鼓励；复制对话落款陪伴天数' },
      { v: '2.4', t: '扫描分钟并入今日放松目标；撤回可改后重发；徽章列表可复制；周报补连续倾诉；今夜托付明早回看；扫描连续天数' },
      { v: '2.3', t: '聊天可分享给朋友；往期周报可点击复制；抽卡当天不重复；分流卡一键直达；三件小事周计数；更新日志可复制' },
      { v: '2.2', t: '充电站第 15 卡「考砸之后」；新手引导 4 步含呼吸；周六温和复盘；周报低日可一键去充电站' },
      { v: '2.1', t: '身体扫描 3 分钟快扫；连续倾诉天数 🔥；常用触发词置顶；呼吸连 7 天徽章；求助话术收进常用语' },
      { v: '2.0', t: '安全自检 3 问；运营页离线兜底缓存；第 14 卡「情绪在身体里的位置」；间隔问候与深夜提示' },
      { v: '1.9', t: '第 8 节课「和父母好好说话」；小测选项随机打乱；周报含晚间小结；本周全勤庆祝' },
      { v: '1.8', t: '温故正确率/每课重学遍数；呼吸最长连练纪录；充电站 NEW 角标与心情筛选' },
      { v: '1.7', t: '自评近3次对比条与首次至今变化；求助话术9情境；想法盒、学习日历、月度进度条' },
      { v: '1.6', t: '心理小课 7 节 + 温故一题 + 结业卡；小结日记本；情绪词库卡' },
      { v: '1.5', t: '安全包支持存电话一键拨打；「帮助朋友」危机卡；话术 7 种情境' },
      { v: '1.4', t: '我的常用语；周一上周陪伴小结；连续空白温柔提醒' },
      { v: '1.3', t: '自定义呼吸节奏 + 近 4 周热力图；按场景三件小事灵感' },
      { v: '1.2', t: '情绪急救包；今日小结；今日心情卡分享图' },
      { v: '1.1', t: '想法小剧场、信匣、四段危机回访、5-4-3-2-1 接地术' }
    ]
  },

  openNotice() { this.setData({ showNotice: true }); },
  closeNotice() { this.setData({ showNotice: false }); },
  noop() {},

  onLoad(options) {
    if (options && options.src === 'share') this.setData({ shared: true });
    this.setData({ welcomed: wx.getStorageSync('hb_welcomed') === true, todayLine: todayLine(), weekGreet: WEEK_LINE[new Date().getDay()], timeGreet: this.hourGreet() }); // 首次引导卡只出现一次
    // 我的金句：小课里存下的每天晒一条（本地）
    const gold = wx.getStorageSync('hb_goldenLines') || [];
    if (gold.length) this.setData({ goldenLine: gold[(new Date().getDate() + new Date().getMonth()) % gold.length] });
    // 写给下周的自己：周日留一句，整周回看（本地方周）
    const wp = wx.getStorageSync('hb_weekPlan') || {};
    this.setData({ weekPlan: (wp && wp.text) || '', weekPlanSet: !!(wp && wp.text) });
    this.setData({ todayCare: this.buildTodayCare() }); // 今日状态卡
    this.setData({ weekCare: this.buildWeekCare() }); // 本周照顾小结
    this.setData({ nurture: this.buildNurture() }); // 今日滋养三连
    this.setData({ examMorning: this.buildExamMorning() }); // 考试当天早餐卡
    this.buildExamCountdown();
    this.setData({ examWrap: this.buildExamWrap() }); // 考完的傍晚收尾卡
    this.setData({ preExam: this.buildPreExam() }); // 考前 7 天一点计划
    this.setData({ afterword: wx.getStorageSync('hb_examAfterword') || '', afterSaved: !!wx.getStorageSync('hb_examAfterword') }); // 考后归位
    this.setData({ afterShow: this.buildExamAfter() }); // 考完 1-3 天归位输入
    this.setData({ nightWrap: new Date().getHours() >= 21 && new Date().getHours() < 24 }); // 晚间收个尾
    const sl = wx.getStorageSync('hb_sleepLog') || {};
    this.setData({ sleepRec: sl[new Date().toDateString()] || null }); // 今晚打算几点睡
    const hr = new Date().getHours();
    if (hr >= 23) {
      const ppl = (wx.getStorageSync('hbSafePeople') || '').trim();
      if (ppl) this.setData({ nightSafe: ppl.split('、')[0].trim() });
    }
    this.setData({ openCount: wx.getStorageSync('hb_openCount') || 0 }); // 陪伴纪念日：第 N 次回来
    const savedRole = wx.getStorageSync('hb_role') || '';
    this.setData({ role: savedRole, roleTip: ROLE_HINT[savedRole] || '' });
    // 继续上次：最近离开的功能页，欢迎页一键直达
    const last = wx.getStorageSync('hbLastRoute') || '';
    const ROUTE_LABEL = {
      'pages/chat/chat': '继续上次对话',
      'pages/mood/mood': '回心情页看看',
      'pages/breathe/breathe': '回去呼吸',
      'pages/scan/scan': '回去扫描',
      'pages/station/station': '回充电站',
      'pages/report/report': '看报告',
      'pages/edu/edu': '回小课',
      'pages/profile/profile': '回我的',
      'pages/assessment/assessment': '回自评',
      'pages/helper/helper': '回求助页',
      'pages/privacy/privacy': '',
      'pages/ops/ops': ''
    };
    if (ROUTE_LABEL[last]) this.setData({ lastRoute: last, lastLabel: ROUTE_LABEL[last] });
    if (!wx.getStorageSync('privacyAgreed')) {
      this.setData({ loading: false });
      return;
    }
    // 已同意过，直接进主页
    wx.switchTab({ url: '/pages/chat/chat' });
  },

  // 继续上次：直接回到最近停留的页面
  goLast() {
    if (!this.data.lastRoute) return;
    if (this.data.lastRoute.indexOf('pages/chat/chat') === 0) { wx.switchTab({ url: this.data.lastRoute }); }
    else wx.navigateTo({ url: '/' + this.data.lastRoute });
  },

  // 今日状态卡：盘点今天对自己照顾了什么（纯本地，跨页统一口径）
  buildTodayCare() {
    const now = new Date();
    const todayStr = now.toDateString();
    let relaxMin = 0, scanN = 0, mood = false, small = false;
    // 呼吸 + 扫描放松分钟（统一口径 hb_breatheDay / hb_relaxScan）
    const bd = wx.getStorageSync('hb_breatheDay') || {};
    if (bd && bd.date === todayStr) relaxMin += bd.mins || 0;
    const rd = wx.getStorageSync('hb_relaxScan') || {};
    if (rd && rd.date === todayStr) relaxMin += rd.mins || 0;
    // 扫描次数：今日完成日志
    scanN = (wx.getStorageSync('hb_scanDoneLog') || []).filter((t) => new Date(t).toDateString() === todayStr).length;
    // 三件小事：今天做满了才记
    small = (wx.getStorageSync('hb_smallDays') || []).includes(todayStr);
    // 心情：今日记录过（同 chat 晨间提醒口径：toDateString）
    mood = wx.getStorageSync('hb_lastMoodDate') === todayStr;
    return { relaxMin, scanN, mood, small };
  },

  // 考试倒计时：≤30 天且非当天，顶部一句「还有 N 天」
  buildExamCountdown() {
    const dateStr = wx.getStorageSync('hb_examDate') || '';
    if (!dateStr) return;
    const name = wx.getStorageSync('hb_examName') || '考试';
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const ex = new Date(dateStr); ex.setHours(0, 0, 0, 0);
    const diff = Math.round((ex - t) / 86400000);
    if (diff > 0 && diff <= 30) this.setData({ examCountdown: '📅 距' + name + '还有 ' + diff + ' 天——不急，一天一天来' });
  },

  // 考试当天早晨：设了考试日且就是今天 → 显示「早晨 5 步」清单
  buildExamMorning() {
    const dateStr = wx.getStorageSync('hb_examDate') || '';
    if (!dateStr) return null;
    const name = wx.getStorageSync('hb_examName') || '考试';
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const ex = new Date(dateStr); ex.setHours(0, 0, 0, 0);
    if (t.getTime() !== ex.getTime()) return null;
    return { name };
  },

  // 考后归位：考试结束 1-3 天，把「考试」在日记里合上一页
  buildExamAfter() {
    const dateStr = wx.getStorageSync('hb_examDate') || '';
    if (!dateStr || this.data.afterSaved) return null;
    const ex = new Date(dateStr); ex.setHours(0, 0, 0, 0);
    const gap = Math.round((Date.now() - ex.getTime()) / 86400000);
    if (gap < 1 || gap > 3) return null;
    return true;
  },
  afterInput(e) { this.setData({ afterword: e.detail.value }); },
  saveAfterword() {
    const t = (this.data.afterword || '').trim();
    if (!t) { wx.showToast({ title: '先写一句想留在那里的话', icon: 'none' }); return; }
    wx.setStorageSync('hb_examAfterword', t);
    this.setData({ afterSaved: true });
    wx.showToast({ title: '收好了——那场考试，正式翻页 🌈', icon: 'none' });
  },

  // 睡眠小账本：睡前选一个「打算几点睡」，本地记录，周报看平均
  pickSleep(e) {
    const hour = e.currentTarget.dataset.h;
    const today = new Date().toDateString();
    const rec = wx.getStorageSync('hb_sleepLog') || {};
    rec[today] = hour;
    wx.setStorageSync('hb_sleepLog', rec);
    this.setData({ sleepRec: hour });
    wx.showToast({ title: '记下了，晚安 🌙', icon: 'none' });
  },

  // 考前 7 天「每天一点点」：第 7 天到考前一天每天一个 5 分钟动作
  buildPreExam() {
    const dateStr = wx.getStorageSync('hb_examDate') || '';
    if (!dateStr) return null;
    const name = wx.getStorageSync('hb_examName') || '考试';
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const ex = new Date(dateStr); ex.setHours(0, 0, 0, 0);
    const days = Math.round((ex.getTime() - t.getTime()) / 86400000);
    if (days < 0 || days > 7) return null;
    if (days === 0) return null; // 考试当天有专门的早晨/收尾卡
    const PLAN = [
      '第 7 天 · 整理书桌：把最重要的 3 页放最上面，其余收好',
      '第 6 天 · 早睡 30 分钟：给身体先储备一晚好觉',
      '第 5 天 · 走 15 分钟：散步时脑子里什么都可以不想',
      '第 4 天 · 和朋友对一句「考完想去做什么」',
      '第 3 天 · 只复习「最怕的那个知识点」10 分钟就停',
      '第 2 天 · 把考场流程在脑里走一遍（进场/坐下/深呼吸）',
      '第 1 天 · 今晚的复习不超过 30 分钟，然后早点躺下'
    ];
    return { name, days, action: PLAN[7 - days] };
  },

  // 考完收尾卡：考试当天（16 点后）显示「考了一天，今天这样收尾」
  buildExamWrap() {
    const dateStr = wx.getStorageSync('hb_examDate') || '';
    if (!dateStr) return null;
    const name = wx.getStorageSync('hb_examName') || '考试';
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const ex = new Date(dateStr); ex.setHours(0, 0, 0, 0);
    if (t.getTime() !== ex.getTime()) return null;
    if (new Date().getHours() < 16) return null; // 下午 4 点前还在考试，先不打扰
    return { name };
  },

  // 今日滋养三连：喝水/好好吃饭/睡够了（每天各一次，纯本地）
  buildNurture() {
    const today = new Date().toDateString();
    const rec = wx.getStorageSync('hb_nurture') || {};
    return { water: rec.water === today, food: rec.food === today, sleep: rec.sleep === today };
  },
  toggleNurture(e) {
    const k = e.currentTarget.dataset.k;
    const today = new Date().toDateString();
    const rec = wx.getStorageSync('hb_nurture') || {};
    rec[k] = rec[k] === today ? '' : today;
    wx.setStorageSync('hb_nurture', rec);
    this.setData({ nurture: this.buildNurture() });
  },

  // 写给下周的自己：周日晚写一句「下周想照顾自己/想做的事」→ 周一到周日可见提醒
  planInput(e) { this.setData({ weekPlan: e.detail.value }); },
  saveWeekPlan() {
    const t = (this.data.weekPlan || '').trim();
    if (!t) { wx.showToast({ title: '先写一句想对自己说的话', icon: 'none' }); return; }
    wx.setStorageSync('hb_weekPlan', { text: t, at: Date.now() });
    this.setData({ weekPlanSet: true });
    wx.showToast({ title: '收好了，从下周一开始记得 ☀️', icon: 'none' });
  },

  // 一封写给自己的信：把常用语+金句+今天的三件小事拼成一段（复制）
  writeSelfLetter() {
    const phrases = wx.getStorageSync('hb_myPhrases') || [];
    const gold = wx.getStorageSync('hb_goldenLines') || [];
    const small = wx.getStorageSync('hb_smallDays') || [];
    const today = new Date().toDateString();
    const todaySmall = small.includes(today);
    const me = wx.getStorageSync('hb_uname') || '我自己';
    const d = new Date();
    const lines = [
      '写给「' + me + '」的一封信 🕊',
      '', '亲爱的 ' + me + '：',
      '',
      '今天，我想提醒你几件你已经知道的事——',
      ...(gold.slice(0, 3).map((g) => '· ' + g)),
      ...(phrases.slice(0, 3).map((p) => '· 「' + p + '」这句是你自己最常说的')),
      todaySmall ? '· 你今天认真做了三件小事，这已经很了不起。' : '· 就算今天什么都没做，你也值得温柔。',
      '',
      '你是那个一直在照顾自己的人。',
      '—— ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日'
    ];
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '已生成，去看看这封信吧 🐋', icon: 'none' })
    });
  },

  // 本周小结：这一周你照顾自己的总账（纯本地，全部最细口径）
  buildWeekCare() {
    const now = new Date();
    const weekStart = new Date(now.getTime() - ((now.getDay() + 6) % 7) * 86400000);
    weekStart.setHours(0, 0, 0, 0);
    let relaxMin = 0, scanN = 0, smallN = 0;
    // 呼吸/扫描：跨页统一的当日放松分钟（breatheDay + relaxScan），本周范围内累加
    const bd = wx.getStorageSync('hb_breatheDay') || {};
    if (bd && typeof bd === 'object' && new Date(bd.date).getTime() >= weekStart.getTime()) relaxMin += bd.mins || 0;
    const rd = wx.getStorageSync('hb_relaxScan') || {};
    if (rd && typeof rd === 'object' && new Date(rd.date).getTime() >= weekStart.getTime()) relaxMin += rd.mins || 0;
    const doneLog = wx.getStorageSync('hb_scanDoneLog') || [];
    for (const t of doneLog) {
      if (new Date(t).getTime() >= weekStart.getTime()) scanN += 1;
    }
    const smallDays = wx.getStorageSync('hb_smallDays') || [];
    for (const k of smallDays) {
      if (new Date(k + ' 00:00:00').getTime() >= weekStart.getTime()) smallN += 1;
    }
    // 本周心情天数（云端记录显示在月报里，这里读本地最近日期兜底）
    const ready = relaxMin || scanN || smallN;
    if (!ready) return null;
    return { relaxMin, scanN, smallN };
  },

  // 谁在用：选择身份，心语就用更贴的那句迎接你（本地记住）
  pickRole(e) {
    const r = e.currentTarget.dataset.r;
    if (!r) return;
    wx.setStorageSync('hb_role', r);
    this.setData({ role: r, roleTip: ROLE_HINT[r] });
    wx.showToast({ title: '已记住，心语会用更贴的方式陪你', icon: 'none' });
  },

  // 今日状态卡：点击某个照顾项直达对应页
  goTodayTap(e) {
    const r = e.currentTarget.dataset.r;
    if (r === 'breathe') wx.navigateTo({ url: '/pages/breathe/breathe' });
    else if (r === 'scan') wx.navigateTo({ url: '/pages/scan/scan' });
    else if (r === 'mood') wx.switchTab({ url: '/pages/mood/mood' });
  },

  // 今日一句：点击复制（随时带走一句温柔）
  // 换一句：今天的句子不合胃口？重抽一条
  shuffleTodayLine() {
    const t = anotherTodayLine(this.data.todayLine);
    if (!t) return;
    this.setData({ todayLine: t, goldenSaved: false });
    wx.showToast({ title: '换好啦', icon: 'none' });
  },

  // 把今天的句子收进金句墙（去重，最多 30 条）
  saveTodayToGold() {
    const t = this.data.todayLine;
    if (!t) return;
    let gold = wx.getStorageSync('hb_goldenLines') || [];
    if (gold.includes(t)) { wx.showToast({ title: '这句已经在墙上了 💛', icon: 'none' }); return; }
    gold.unshift(t);
    wx.setStorageSync('hb_goldenLines', gold.slice(0, 30));
    this.setData({ goldenSaved: true });
    wx.showToast({ title: '收进金句墙了 💛', icon: 'none' });
  },

  copyTodayLine() {
    if (!this.data.todayLine) return;
    wx.setClipboardData({ data: this.data.todayLine, success: () => wx.showToast({ title: '已复制今日一句话', icon: 'none' }) });
  },

  // 出门前一轮呼吸：考试早晨卡直达
  goBreatheNow() { wx.navigateTo({ url: '/pages/breathe/breathe' }); },

  // 按时段问候：早上打开看到早上好，深夜打开看到「先照顾好自己」
  hourGreet() {
    const h = new Date().getHours();
    if (h < 5) return '夜深了，先照顾好自己，再找我 ☾';
    if (h < 11) return '早上好，今天也从一点点开始 ☀';
    if (h < 14) return '中午好，别忘了好好吃饭 🍱';
    if (h < 18) return '下午好，累了就歇五分钟 🍵';
    return '晚上好，这一天辛苦了 🌆';
  },

  // 金句墙：把攒下的每句金句都列出来，翻一翻
  viewGoldenWall() {
    const gold = wx.getStorageSync('hb_goldenLines') || [];
    if (!gold.length) {
      wx.showModal({ title: '我的金句墙', content: '还没有金句。在小课/充电站看到喜欢的话，存进来，这里就慢慢亮了。', showCancel: false, confirmText: '知道啦' });
      return;
    }
    const body = gold.map((t, i) => (i + 1) + '）' + t).join('\n');
    wx.showModal({ title: '💛 我的金句墙（' + gold.length + ' 条）', content: body, showCancel: false, confirmText: '收好' });
  },

  // 拿今日一句去聊聊：把今天这句话作为开场白带进聊天页
  goChatWithLine() {
    const t = this.data.todayLine;
    if (!t) return;
    wx.setStorageSync('hb_chatSeed', t);
    wx.navigateTo({ url: '/pages/chat/chat' });
  },

  // 分享给朋友：今日一句当作欢迎语（未同意前也可把温柔带给别人）
  onShareAppMessage() {
    return {
      title: this.data.todayLine || '心语伴 · 随时在线的情绪陪伴者',
      path: '/pages/welcome/welcome?src=share'
    };
  },

  // 分享到朋友圈：同样的今日一句
  onShareTimeline() {
    return {
      title: this.data.todayLine || '心语伴 · 随时在线的情绪陪伴者',
      query: 'src=share'
    };
  },

  toggleLog() { this.setData({ showLog: !this.data.showLog }); },

  // 一键复制更新日志：把最近版本说明整段复制（可发给老师/答辩留档）
  copyLog() {
    const body = ['【心语伴 · 版本更新日志】', '', ...this.data.changelog.map((c) => `v${c.v}：${c.t}`)].join('\n');
    wx.setClipboardData({ data: body, success: () => wx.showToast({ title: '已复制版本说明', icon: 'success' }) });
  },

  goFromGuide(e) {
    const u = e.currentTarget.dataset.u;
    wx.setStorageSync('hb_welcomed', true);
    if (!u || !wx.getStorageSync('privacyAgreed')) { this.setData({ welcomed: true }); return; }
    // 页签（tabBar）用 switchTab，普通页用 navigateTo（呼吸/求助等都不是 tab）
    const tabs = ['/pages/chat/chat', '/pages/mood/mood', '/pages/helper/helper', '/pages/profile/profile'];
    if (tabs.indexOf(u) >= 0) wx.switchTab({ url: u });
    else wx.navigateTo({ url: u });
  },

  hideGuide() {
    wx.setStorageSync('hb_welcomed', true);
    this.setData({ welcomed: true });
  },

  ensureLogin: async function () {
    let openid = app.globalData.openid;
    if (!openid) openid = await app.login();
    return openid;
  },

  async agree() {
    wx.showLoading({ title: '加载中', mask: true });
    await this.ensureLogin();
    wx.hideLoading();
    wx.setStorageSync('privacyAgreed', true);
    wx.switchTab({ url: '/pages/chat/chat' });
  },

  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); },

  goTest() { wx.navigateTo({ url: '/pages/assessment/assessment' }); },

  goBreathe() { wx.switchTab({ url: '/pages/breathe/breathe' }); },

  goMood() { wx.switchTab({ url: '/pages/mood/mood' }); }
});