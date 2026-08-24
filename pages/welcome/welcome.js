// pages/welcome/welcome.js —— 隐私同意 & AI 使用说明
const app = getApp();
const { dailyQuotes } = require('../../config/index');

// 今日一句（日轮换，与 chat/充电站同源）
function todayLine() {
  const d = new Date();
  return dailyQuotes[(d.getDate() + d.getMonth()) % dailyQuotes.length] || '';
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
    todayCare: null,   // 今日状态卡：今天对自己照顾了什么（呼吸/记录/小事）
    role: '',          // 谁在用：student/teacher/parent/other（本地记住）
    roleTip: '',
    lastRoute: '',  // 继续上次：最近离开的功能页路径
    lastLabel: '',  // 继续上次的按钮文案
    changelog: [
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
    this.setData({ welcomed: wx.getStorageSync('hb_welcomed') === true, todayLine: todayLine() }); // 首次引导卡只出现一次
    this.setData({ todayCare: this.buildTodayCare() }); // 今日状态卡
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
  copyTodayLine() {
    if (!this.data.todayLine) return;
    wx.setClipboardData({ data: this.data.todayLine, success: () => wx.showToast({ title: '已复制今日一句话', icon: 'none' }) });
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