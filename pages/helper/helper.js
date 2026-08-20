// pages/helper/helper.js —— 求助中心
const { hotlines } = require('../../config/index');

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

Page({
  data: {
    hotlines,
    safety: false, // 是否已设置 24 小时回访
    safetyHint: '',
    care: null,      // 今日关怀 { emoji, title, text }
    englishPhrases: []  // 英文小抄（一键复制）
  },

  onLoad() {
    const t = wx.getStorageSync('crisisCheck');
    if (t && t > Date.now()) this.setData({ safety: true });
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

  call(e) {
    const number = e.currentTarget.dataset.number;
    if (!number) return;
    wx.makePhoneCall({ phoneNumber: number, fail: () => {} });
  },

  goBreathe() {
    wx.navigateTo({ url: '/pages/breathe/breathe' });
  },

  // 已安全回执：24 小时后在「陪伴」页轻声回访一次
  checkSafe() {
    wx.showModal({
      title: '安排 24 小时回访',
      content: '心语会在 24 个小时后，在「陪伴」页轻轻和你说一句“现在好吗”。可以吗？',
      confirmText: '好的',
      success: (r) => {
        if (!r.confirm) return;
        wx.setStorageSync('crisisCheck', Date.now() + 24 * 3600 * 1000);
        if (!wx.getStorageSync('ach_care')) wx.setStorageSync('ach_care', true); // 成就：也请心语来看我
        this.setData({ safety: true });
        wx.showToast({ title: '已安排回访 🌱', icon: 'success' });
      }
    });
  },

  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); }
});