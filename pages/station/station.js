// pages/station/station.js —— 情绪充电站（轻知识 · 一组能马上做的事）
Page({
  data: {
    cards: [
      {
        emoji: '🌀',
        title: '情绪上来时，先做这 4 件事',
        lines: [
          '① 停 5 秒，只观察呼吸的进出',
          '② 给情绪命名：「我现在是…」（焦虑/难过/愤怒…）',
          '③ 问自己：此刻我真正需要什么？',
          '④ 做最小的一件照顾自己的事',
        ]
      },
      {
        emoji: '🧠',
        title: '焦虑时的大脑骗局',
        lines: [
          '· 「绝对化」：总觉得“一定会坏”，其实只是担心不是事实',
          '· 「灾难化」：把一次不舒服放大成整个世界',
          '· 给想法打个问号：这是事实，还是我的推测？',
          '· 只做当下能控制的那 1 步'
        ]
      },
      {
        emoji: '🌙',
        title: '睡前安神 5 分钟',
        lines: [
          '· 深呼 4 秒 → 憋 4 秒 → 缓吐 6 秒，重复 5 轮',
          '· 把明天的事写在一张纸上（卸下来，明天再看）',
          '· 关掉亮光，让身体先凉下来 1 度',
          '· 如果还是睡不着，允许自己“躺着休息”也是休息'
        ]
      },
      {
        emoji: '💌',
        title: '给低落的自己写一封信',
        lines: [
          '· “我知道这几天很难，但我还在…”',
          '· “我最不愿意放弃的东西是…”',
          '· “如果朋友像我一样低落，我会对 TA 说…”',
          '· 写完放好，难过时再拿出来读给自己听'
        ]
      },
      {
        emoji: '🐢',
        title: '总在拖延？来个「2 分钟启动式」',
        lines: [
          '· 别想“做完”，只想“今天做第一步”',
          '· 把任务拆到小到迈不开：打开书、摆好纸笔',
          '· 默默数 5…4…3…2…1，倒数完身体就先动了',
          '· 做完第一步就停一下，夸自己一句，再开下一轮',
          '· 记住：最难的不是完成任务，是开始那一下'
        ]
      },
      {
        emoji: '🆘',
        title: '什么样的情况，不只是情绪？',
        lines: [
          '· 持续 2 周以上几乎每天低落/失眠/食欲大变',
          '· 有“我消失了更好”或伤害自己的念头',
          '· 严重到影响上学、考试、工作与亲密关系',
          '· 出现以上情况：请一定要告诉信任的大人，或去「求助」页联系热线'
        ]
      }
    ],
    open: -1   // 当前展开的卡片索引
  },

  toggleCard(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ open: this.data.open === i ? -1 : i });
  },

  goHelper() {
    wx.switchTab({ url: '/pages/helper/helper' });
  },

  goBreathe() {
    wx.navigateTo({ url: '/pages/breathe/breathe' });
  },

  goChat() {
    wx.switchTab({ url: '/pages/chat/chat' });
  },

  goMood() {
    wx.switchTab({ url: '/pages/mood/mood' });
  },

  onShareAppMessage() {
    return { title: '心语伴 · 情绪充电站', path: '/pages/station/station' };
  }
});