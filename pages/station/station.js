// pages/station/station.js —— 情绪充电站（轻知识 · 一组能马上做的事）
const { dailyQuotes: DAILY_LINES } = require('../../config/index');
Page({
  data: {
    todayLine: '',
    favTitles: [],      // 收藏的卡片标题（最多 3 张，置顶+★）
    cardTags: ['全部', '焦虑', '难过', '生气', '睡前', '学习', '平静'],
    showTag: '全部',    // 按心情筛选当前展示哪些卡
    topRead: null,      // 最常翻的一张卡（≥3 次才显示）
    drawMsg: '',        // 抽一张后的缘分提示
    readTotal: 0,       // 卡片阅读总数
    newCount: 0,        // 还没看过的卡片数（NEW 角标）
    drawOther: '',      // 抽一张后顺带推荐的另一张
    cards: [
      {
        emoji: '🌀',
        title: '情绪上来时，先做这 4 件事',
        tags: ['焦虑', '难过', '生气'],
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
        tags: ['焦虑', '学习'],
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
        tags: ['睡前', '平静'],
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
        tags: ['难过'],
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
        tags: ['学习'],
        lines: [
          '· 别想“做完”，只想“今天做第一步”',
          '· 把任务拆到小到迈不开：打开书、摆好纸笔',
          '· 默默数 5…4…3…2…1，倒数完身体就先动了',
          '· 做完第一步就停一下，夸自己一句，再开下一轮',
          '· 记住：最难的不是完成任务，是开始那一下'
        ]
      },
      {
        emoji: '📝',
        title: '睡前 2 清单 · 安心收尾',
        tags: ['睡前'],
        lines: [
          '· 今天做到的 3 件小事（哪怕只有“喝了一杯水”）',
          '· 明天只做 1 件事（写下来，明天只还这一件）',
          '· 写完放下手机：今天的你，已经做完了今天该做的',
          '· 晚安，这是你留给自己的拥抱'
        ]
      },
      {
        emoji: '🔥',
        title: '气得发抖时 · 60 秒降火',
        tags: ['生气'],
        lines: [
          '· 先说一句定住自己：「我现在很气，但我不会立刻炸开」',
          '· 吸气 4 秒 → 停 2 秒 → 呼气 6 秒，做 5 轮',
          '· 脚趾抓地再松开 3 次，先让身体回到当下',
          '· 然后只做一件小事：离开现场 10 分钟，或把手浸凉水',
          '· 气是真的，但要不要炸，是你选的'
        ]
      },
      {
        emoji: '🪐',
        title: '脑子太满？发呆 2 分钟',
        tags: ['平静'],
        lines: [
          '· 发呆不是浪费时间：大脑放松时，会自动整理碎片',
          '· 坐直、眼睛放空、什么都不用想',
          '· 思绪飘走了就拉回来——就是“看着窗外某个点”',
          '· 2 分钟就好：比你想的有用',
          '· 会去「呼吸练习」选“发呆 2 分钟”，心语陪你静下来'
        ]
      },
      {
        emoji: '🆘',
        title: '什么样的情况，不只是情绪？',
        tags: ['难过', '焦虑'],
        lines: [
          '· 持续 2 周以上几乎每天低落 / 失眠 / 食欲大变',
          '· 有“我消失了更好”或伤害自己的念头',
          '· 严重到影响上学、考试、工作与亲密关系',
          '· 出现以上情况：请一定要告诉信任的大人，或去「求助」页联系热线'
        ]
      },
      {
        emoji: '👀',
        title: '5-4-3-2-1：随时能用的接地术',
        tags: ['焦虑', '生气'],
        lines: [
          '焦虑像潮水漫上来时，用五个感官把自己“钉回地面”：',
          '· 看 5 样东西：说出你看到的 5 样东西（水杯、窗帘…）',
          '· 摸 4 样东西：能碰到皮肤的 4 个物件',
          '· 听 3 种声音：听到的 3 种声音',
          '· 闻 2 种气味：闻得到的 2 种气味',
          '· 尝 1 种味道：或喝一小口水。',
          '做完一套只需要 2 分钟，身体会先于头脑平静下来。'
        ]
      },
      {
        emoji: '🌒',
        title: '考前一夜 · 就做这 3 件事',
        tags: ['学习', '睡前'],
        lines: [
          '① 收尾不刷新：不再做新题，只翻一遍错题本的标题（10 分钟封顶）。',
          '② 准备明早：准考证、笔、水杯放门口，减少明早的慌乱。',
          '③ 10 点半躺下：睡前做一轮 4-4-6 呼吸，告诉自己「准备到这，已经够了」。',
          '睡不够不可怕，可怕的是熬到半夜还焦虑——今晚的任务是休息，不是复习。'
        ]
      },
      {
        emoji: '🌅',
        title: '考试当天早晨 · 5 分钟',
        tags: ['学习'],
        lines: [
          '① 不对答案、不翻书：出门前 30 分钟不看任何资料，只看清单。',
          '② 早餐吃熟悉的：平时吃什么就吃什么，肠胃不冒险。',
          '③ 深呼吸 3 次再进考场：吸气 4 秒、呼气 6 秒，做 3 轮。',
          '④ 开考先写名字，再通览整卷：把「我会的」先圈出来。',
          '记住：一场考试考不出你这个人的全部。'
        ]
      },
      {
        emoji: '🔤',
        title: '情绪词库 · 先准确叫出它的名字',
        tags: ['难过', '生气', '焦虑'],
        lines: [
          '生气一族：烦躁 / 恼火 / 憋屈 / 愤懑 / 暴怒',
          '难过一族：低落 / 委屈 / 失落 / 空落落 / 心碎',
          '焦虑一族：紧张 / 担心 / 忐忑 / 心慌 / 恐慌',
          '疲惫一族：累 / 倦怠 / 提不起劲 / 被掏空',
          '害怕一族：不安 / 胆怯 / 惊慌 / 无助',
          '把「我不舒服」换成更准的那个词——命名越准，情绪降温越快（心理学叫「情绪标注」）。'
        ]
      }
    ],
    open: -1   // 当前展开的卡片索引
  },

  // 收藏置顶：长按卡片头 ★ 收藏/取消（本地，最多 3 张）
  applyFavs() {
    const favs = wx.getStorageSync('hb_stFavs') || [];
    const tag = this.data.showTag || '全部';
    const src = (this._allCards || this.data.cards || []).slice();
    const cards = tag === '全部' ? src : src.filter((c) => (c.tags || []).includes(tag));
    cards.sort((a, b) => {
      const fa = favs.indexOf(a.title), fb = favs.indexOf(b.title);
      if (fa === -1 && fb === -1) return 0;
      if (fa === -1) return 1;
      if (fb === -1) return -1;
      return fa - fb;
    });
    this.setData({ cards, favTitles: favs });
  },

  toggleFav(e) {
    const t = e.currentTarget.dataset.t;
    if (!t) return;
    let favs = wx.getStorageSync('hb_stFavs') || [];
    if (favs.includes(t)) favs = favs.filter((x) => x !== t);
    else {
      if (favs.length >= 3) { wx.showToast({ title: '最多收藏 3 张，先取消一张', icon: 'none' }); return; }
      favs.push(t);
    }
    wx.setStorageSync('hb_stFavs', favs);
    const open = favs.includes(t) ? (this.data.cards || []).findIndex((c) => c.title === t) : this.data.open;
    this.setData({ favTitles: favs });
    this.applyFavs();
    if (open >= 0) this.setData({ open });
    wx.showToast({ title: favs.includes(t) ? '已收藏置顶 ★' : '已取消收藏', icon: 'none' });
  },

  onShow() {
    if (!this._allCards) this._allCards = this.data.cards.slice();
    // NEW 标记：没看过的卡（hb_stReads 无记录）计数，展开过自动消
    const reads0 = wx.getStorageSync('hb_stReads') || {};
    this.setData({ newCount: (this._allCards || []).filter((c) => !reads0[c.title]).length });
    this.setData({ todayLine: this.getDailyLine() });
    this.applyFavs();
    // 常读 Top1：阅读次数最多的卡（≥3 次才提示）
    const reads = wx.getStorageSync('hb_stReads') || {};
    const keys = Object.keys(reads).sort((a, b) => reads[b] - reads[a]);
    const top = keys[0];
    this.setData({ topRead: (top && reads[top] >= 3) ? { title: top, n: reads[top] } : null });
    // 阅读总数：所有卡片的展开次数之和
    const totalReads = keys.reduce((a, k) => a + reads[k], 0);
    this.setData({ readTotal: totalReads });
  },

  setCardTag(e) {
    const t = e.currentTarget.dataset.t;
    this.setData({ showTag: t, open: -1 });
    this.applyFavs();
  },

  toggleCard(e) {
    const i = Number(e.currentTarget.dataset.index);
    const willOpen = this.data.open !== i;
    if (willOpen) {
      // 阅读计数：展开即读（本地，用于了解自己最常翻哪张）
      const c = (this.data.cards || [])[i];
      if (c) {
        const reads = wx.getStorageSync('hb_stReads') || {};
        reads[c.title] = (reads[c.title] || 0) + 1;
        wx.setStorageSync('hb_stReads', reads);
      }
    }
    this.setData({ open: willOpen ? i : -1 });
  },

  goHelper() {
    wx.switchTab({ url: '/pages/helper/helper' });
  },

  // 随机抽一张：不知道做什么时，让今天「抽」到你（展开随机卡片）
  randomCard() {
    const cards = this.data.cards || [];
    if (!cards.length) return;
    const i = Math.floor(Math.random() * cards.length);
    // 抽中计数：第 N 次抽到同一张，说明它跟你有缘
    const c = cards[i];
    const cnt = wx.getStorageSync('hb_stDraws') || {};
    cnt[c.title] = (cnt[c.title] || 0) + 1;
    wx.setStorageSync('hb_stDraws', cnt);
    // 顺手推荐另一张（不同的卡），点一下直接展开
    const others = cards.filter((x, j) => j !== i);
    const other = others[Math.floor(Math.random() * others.length)];
    this.setData({
      open: i,
      drawMsg: cnt[c.title] > 1 ? '第 ' + cnt[c.title] + ' 次抽中「' + c.title + '」——它好像特别懂你。' : '',
      drawOther: other ? other.title : ''
    });
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  openDrawOther() {
    const t = this.data.drawOther;
    if (!t) return;
    const i = (this.data.cards || []).findIndex((c) => c.title === t);
    if (i >= 0) this.setData({ open: i, drawOther: '' });
  },

  copyCard(e) {
    const i = Number(e.currentTarget.dataset.i);
    const c = (this.data.cards || [])[i];
    if (!c) return;
    const body = ['【心语伴 · 充电站】' + c.emoji + ' ' + c.title, '', ...c.lines.map((l) => (l.startsWith('·') ? l : '· ' + l))].join('\n');
    wx.setClipboardData({ data: body, success: () => wx.showToast({ title: '已复制这张卡', icon: 'success' }) });
  },

  goEdu() {
    wx.navigateTo({ url: '/pages/edu/edu' });
  },

  goBreathe() {
    wx.navigateTo({ url: '/pages/breathe/breathe' });
  },
  // 换一句：当日轮换之外，手动换一张（当日一次，换过的当天不再换）
  reshuffleLine() {
    const key = 'hb_lineShuffled_' + new Date().toDateString();
    if (wx.getStorageSync(key)) { wx.showToast({ title: '今天已经换过一次啦', icon: 'none' }); return; }
    const cur = (this.data.todayLine || '').replace('🫧 ', '');
    const pool = DAILY_LINES.filter((l) => l !== cur);
    wx.setStorageSync(key, true);
    this.setData({ todayLine: '🫧 ' + pool[Math.floor(Math.random() * pool.length)] });
  },

  getDailyLine() {
    try {
      const idx = Math.floor(Date.now() / 86400000) % DAILY_LINES.length;
      return '🫧 ' + DAILY_LINES[idx];
    } catch (e) { return ''; }
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