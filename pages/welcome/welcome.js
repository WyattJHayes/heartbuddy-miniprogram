// pages/welcome/welcome.js —— 隐私同意 & AI 使用说明
const app = getApp();
const { dailyQuotes } = require('../../config/index');

// 今日一句（日轮换，与 chat/充电站同源）
function todayLine() {
  const d = new Date();
  return dailyQuotes[(d.getDate() + d.getMonth()) % dailyQuotes.length] || '';
}

Page({
  data: {
    loading: true, openid: '', showNotice: false, shared: false, welcomed: true, showLog: false,
    todayLine: '',
    changelog: [
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
    if (!wx.getStorageSync('privacyAgreed')) {
      this.setData({ loading: false });
      return;
    }
    // 已同意过，直接进主页
    wx.switchTab({ url: '/pages/chat/chat' });
  },

  // 今日一句：点击复制（随时带走一句温柔）
  copyTodayLine() {
    if (!this.data.todayLine) return;
    wx.setClipboardData({ data: this.data.todayLine, success: () => wx.showToast({ title: '已复制今日一句话', icon: 'none' }) });
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

  goMood() { wx.switchTab({ url: '/pages/mood/mood' }); }
});