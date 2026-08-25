// pages/station/station.js —— 情绪充电站（轻知识 · 一组能马上做的事）
const app = getApp();
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
    recMood: '',    // 最近一次心情（关键词推荐来源）
    recCards: null,  // 推荐卡 {index,title} 列表
    stReads: {},        // 各卡已读次数（展示用）
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
        ],
        act: { k: 'breathe', label: '跟着去呼吸 5 分钟' }
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
        ],
        act: { k: 'mood', label: '去心情页写吧' }
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
        ],
        act: { k: 'mood', label: '去记一笔「开始的第一步」' }
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
        ],
        act: { k: 'breathe', label: '睡前再来一轮呼吸' }
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
        ],
        act: { k: 'breathe', label: '跟着做 60 秒呼吸' }
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
        emoji: '🫀',
        title: '情绪藏在身体的哪里？',
        tags: ['焦虑', '难过', '生气'],
        lines: [
          '肩颈发紧、牙关咬紧 —— 常是「压力/生气」在身体上的样子',
          '胃里发堵、吃不下 —— 焦虑最爱的藏身处之一',
          '胸口发闷、想叹气 —— 多半是委屈或难过',
          '手心出汗、心悸 —— 恐慌/紧张的身体信号',
          '浑身发沉、不想动 —— 情绪耗竭在喊「我需要休息」',
          '下次说不清情绪时，先扫一遍身体——它往往先一步知道答案。'
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
      },
      {
        emoji: '🪞',
        title: '考砸之后 · 先陪自己 3 分钟',
        tags: ['难过', '焦虑', '学习'],
        lines: [
          '① 先不比较：「别人都比我好」是焦虑在夸大，你只面对自己的卷子。',
          '② 好好难过 3 分钟：允许失落，别急着自我攻击——情绪会过去的。',
          '③ 然后把「……」换成课程：考完试 ≠ 结果定死，先把知识点是哪课圈出来。',
          '记住：一次考试量不出你这个人，它只是今天的「一件事」。'
        ]
      },
      {
        title: '等结果的日子 · 先稳住这 3 件事',
        tags: ['考前', '焦虑', '等待'],
        lines: [
          '① 把「等」换成「做」：结果出来前安排一件有进度的事（整理错题/预习），比来回想结果有用。',
          '② 固定一个「每天最多想一次」的时段：比如晚饭后 10 分钟想结果，其余时间跑掉了就去做一次呼吸。',
          '③ 先写下「无论结果如何，我都完成过的 3 件事」：不看分数，先承认过程——你确实撑过了这段日子。',
          '等待最磨人，但等待不等于无能为力：结果出来前，你依然能决定今天怎么过。'
        ]
      },
      {
        title: '心情像过山车 · 先稳住当下',
        tags: ['情绪', '波动'],
        lines: [
          '① 给心情量个「地基」：波动再大，你的呼吸、你的床、明天的一顿饭都不会变——先抓住这些。',
          '② 把「为什么今天这么差」换成「此刻我需要什么」：饿了就吃，困了就趴十分钟，累就少做一件事。',
          '③ 写下「最近一次心情回升」是因为什么：多半是有朋友说了句话/睡了一觉——那些是你的「回升开关」。',
          '情绪像过山车很正常，你不是坏掉了，只是处在起伏里。'
        ]
      },
      {
        title: '刷手机停不下来的累',
        tags: ['睡前', '习惯', '分心'],
        lines: [
          '① 先别骂自己：刷手机不是意志力差，是大脑想要「新鲜的放松」，它只是选错了方式。',
          '② 今晚试「看完这条就锁 10 分钟」：锁屏后做一次 4-4-6 呼吸，比硬扛更容易停下来。',
          '③ 给自己一个「换手」清单：水杯/窗边/纸笔，把手机放远一格，手一有空就去做 10 秒的。',
          '不是要戒掉手机，而是让「停」变得不难受——你只是需要另一种出口。'
        ]
      },
      {
        title: '考试前一晚 · 睡好与稳住',
        tags: ['考前', '睡眠', '稳'],
        lines: [
          '① 今晚的目标不是「睡够 8 小时」，而是「躺下就足够」：睡不着不等于考不好，这一夜谁都睡不着过。',
          '② 提前 90 分钟把明亮灯换成暗光，手机放远（睡前刷反而让你更清醒），听一段轻音乐/白噪音垫底。',
          '③ 躺下后如果脑子开始「过考点」，别跟着它跑：做一轮 4-4-6 呼吸，把注意力一次次放回呼吸，它自己会安静。',
          '明天要你带进考场的不是「昨晚睡了多久」，而是「今晚你轻轻放过了自己」——这种放过，比熬夜复习更有用。'
        ]
      },
      {
        title: '想开始却起不来 · 拖延急救',
        tags: ['学习', '拖延', '行动'],
        lines: [
          '① 起不来的不是「懒」，是那个任务太大太模糊。把它切到「小到荒唐」：只写第一行、只读一页、只做 5 分钟。',
          '② 用「三分钟启动协议」：告诉自己「我就做 3 分钟」，3 分钟后还想停就停——但多数人做完 3 分钟就能续上。',
          '③ 把手机放到另一个房间/交给别人 15 分钟：不是靠意志力，是让「分心」变难一点点，就赢了。',
          '不想做事很正常，不等于你不行。启动比完美重要，「开始了」这一步本身就值得算一天。'
        ]
      },
      {
        title: '考完 · 空落落的那几天',
        tags: ['考后', '落差', '过渡'],
        lines: [
          '① 先承认：考完的空落落是正常的，不是「矫情」。连着几个月被安排得满满的，突然没有「下一步」，身体会不知所措。',
          '② 给这 3 天排一个「轻轻清单」：睡到自然醒、见见很久没见的人、整理书桌、做一件纯娱乐的事——不需要有「意义」。',
          '③ 把「等结果」变成一个仪式：写一封给两个月后查分的自己，无论结果如何，先夸一夸撑到这里的自己。',
          '人生不是一场考试的翻面。结果出来前，你已经先学会了「允许自己休息」——这比任何分数都值钱。'
        ]
      },
      {
        title: '谁都不想理 · 把情绪藏起来的时候',
        tags: ['情绪', '封闭', '独处'],
        lines: [
          '① 先允许自己「现在就藏一会儿」：不想说就不说，这不叫错。给自己一个 30 分钟的「安静的角落预约」。',
          '② 藏 ≠ 消失：找个最普通的出口，写两行字、走一圈、把音乐音量调大五分钟——别让情绪憋到夜里一起找上门。',
          '③ 给自己设一个「温柔的到期」：比如今晚睡前，问自己一句「要不要把它们里的某一件拿出来说说？」——能说再说，不说也可以。',
          '不想被看见的时刻，也是你的一部分。藏起来不等于坏掉，你在用自己的方式先活下去。'
        ]
      },
      {
        title: '跟朋友闹别扭之后',
        tags: ['友情', '冲突', '修复'],
        lines: [
          '① 先分清楚「发生了什么」而不是「谁错了」：把「TA 都不理我」改成「TA 最近没找我」，情绪先退一步。',
          '② 给愤怒一个「冷一冷」：48 小时内不赌气删人、不发朋友圈吐槽。想说的话先写进草稿，能压住冲动。',
          '③ 用一个很小的动作破冰：借道「课间借个橡皮」「把 TA 爱吃的东西带一份」——修复不需要先道歉，动作比话早到。',
          '闹别扭不是关系的终点，是「温度计」：它疼，说明你们之间还有期待。'
        ]
      },
      {
        title: '我允许自己 · 8 个许可',
        tags: ['接纳', '自我', '温和'],
        lines: [
          '① 允许自己「暂时没做好」——没做好不等于没尽力',
          '② 允许自己「拒绝」——不想去就不去，理由足够是你自己',
          '③ 允许自己「有情绪」——情绪不是坏，是需要被听见',
          '④ 允许自己「慢慢来」——快节奏不属于所有人',
          '⑤ 允许自己「暂时做不到」——允许「暂时」，也给进步留了门',
          '⑥ 允许自己「被讨厌」——你无法让所有人满意，那是别人的期待不是你的错',
          '⑦ 允许自己「休息」——休息不是浪费时间，是给能量充电',
          '⑧ 允许自己「有时需要别人」——求助是勇气，不是软弱'
        ],
        act: { k: 'chat', label: '把一句许可送给自己' }
      },
      {
        title: '5-4-3-2-1 落地法 · 把飘走的自己拉回来',
        tags: ['焦虑', '睡前', '平静'],
        lines: [
          '焦虑时，大脑飞得太快——5-4-3-2-1 是「看见当下」的钩子：',
          '👀 5 样你能看到的东西：说颜色，不用评价（「桌子的棕色」「窗外那棵树」）',
          '👂 4 种你能听到的声音：空调、翻页、远处说话……听见了就好',
          '✋ 3 种你能碰到的触感：桌面、衣角、自己的手指',
          '👃 2 种闻到的气味：没有就用力闻自己衣袖',
          '👅 1 种尝到的味道：喝口水，感受它的温度',
          '落到第 1 的时候，你会发现：此刻是具体的，而你在这里。'
        ],
        act: { k: 'breathe', label: '落地后做一次呼吸' }
      },
      {
        title: '担心三栏 · 把「怕」放进格子里',
        tags: ['焦虑', '认知', '学习'],
        lines: [
          '拿张纸（或用便签），对绕不开的担心写下三栏——写在纸上会慢下来：',
          '① 最坏可能是什么？写具体，别写「完了」，写「那科考砸」',
          '② 最可能发生的是什么？通常比最坏的可控得多',
          '③ 即使①发生，我能怎么办？写一个具体动作（「找老师问答题思路」）',
          '三栏写完之后，把纸折起来——不是消灭担心，是把它从「全部」缩小到“一格”。'
        ],
        act: { k: 'chat', label: '把担心说给心语听' }
      },
      {
        title: '反刍思维 · 叫停循环的念头',
        tags: ['焦虑', '睡前', '认知'],
        lines: [
          '同一件事翻来覆去想、越想越糟——这叫「反刍」。它不解决问题，只消耗你。',
          '① 给它起个名字：「哦，是那个『考砸了怎么办』又来了」——命名会让它从「我」变成「它」',
          '② 设一个「担忧时间」：今晚 21:00-21:15 专门想它，其它时间来了就说「到点了再说」',
          '③ 换一个动作通道：起身洗把脸 / 整理桌面 / 出门走 5 分钟，让身体先离开那个念头',
          '④ 写下来一次就够：写在纸上并画个圈——纸接住了，脑子就可以放下了'
        ],
        act: { k: 'breathe', label: '先做一轮呼吸降温' }
      }
    ],
    open: -1,   // 当前展开的卡片索引
    kw: '',      // 关键词搜索框（标题/标签/内容匹配，与标签筛选叠加）
    likeCards: [],  // 展开卡时「一起充电」同主题推荐（最多 2 张，未读优先）
    todayReads: 0,   // 今日展开过的卡片数（充电小结）
    favOpen: false,  // 收藏抽屉
    favList: [],      // 收藏抽屉里的完整卡数据
    quickRead: false  // 一句话速读：点卡片只看一句核心，不展开
  },

  // 收藏置顶：长按卡片头 ★ 收藏/取消（本地，最多 3 张）
  applyFavs() {
    const favs = wx.getStorageSync('hb_stFavs') || [];
    const tag = this.data.showTag || '全部';
    const kw = (this.data.kw || '').trim().toLowerCase();
    const src = (this._allCards || this.data.cards || []).slice();
    let cards = tag === '全部' ? src : src.filter((c) => (c.tags || []).includes(tag));
    if (kw) {
      cards = cards.filter((c) => {
        const hay = (c.title + ' ' + (c.tags || []).join(' ') + ' ' + (c.lines || []).join(' ')).toLowerCase();
        return hay.indexOf(kw) > -1;
      });
    }
    cards.sort((a, b) => {
      const fa = favs.indexOf(a.title), fb = favs.indexOf(b.title);
      if (fa === -1 && fb === -1) return 0;
      if (fa === -1) return 1;
      if (fb === -1) return -1;
      return fa - fb;
    });
    this.setData({ cards, favTitles: favs });
  },

  // 关键词搜索（与标签筛选叠加生效）
  // 把收藏的卡拼成一段可发朋友的文字（含每张卡第一句）
  copyFavs() {
    const favs = this.data.favTitles || [];
    if (!favs.length) { wx.showToast({ title: '先收藏一两张卡', icon: 'none' }); return; }
    const all = this._allCards || this.data.cards;
    const lines = ['⭐ 我在「心语伴」收藏的几张情绪小卡：', ''];
    for (const t of favs) {
      const c = all.find((x) => x.title === t);
      lines.push('· ' + t);
      if (c && c.lines && c.lines[0]) lines.push('  ' + String(c.lines[0]).slice(0, 40) + '…');
    }
    lines.push('', '都是能马上做的小事。需要的话你也可以试试 🔋');
    wx.setClipboardData({ data: lines.join('\n'), success: () => wx.showToast({ title: '已复制收藏卡 📋', icon: 'none' }) });
  },

  onSearchInput(e) { this.setData({ kw: e.detail.value }); this.applyFavs(); },
  onSearchConfirm() { wx.hideKeyboard && wx.hideKeyboard(); },
  clearSearch() { this.setData({ kw: '' }); this.applyFavs(); },

  // 一句话速读：开启后点卡只看核心句（不展开全文），适合「此刻只想要一句」
  toggleQuickRead() { this.setData({ quickRead: !this.data.quickRead, open: -1 }); },

  noop() {},

  // 我的收藏抽屉：打开时把收藏的卡完整数据列出来（本地）
  openFavDrawer() {
    const favs = wx.getStorageSync('hb_stFavs') || [];
    const all = this._allCards || [];
    const list = favs.map((t) => all.find((c) => c.title === t)).filter(Boolean);
    this.setData({ favOpen: true, favList: list });
  },
  closeFavDrawer() { this.setData({ favOpen: false }); },

  // 从收藏抽屉里点某张卡 → 关抽屉并展开该卡
  openFavCard(e) {
    const t = e.currentTarget.dataset.t;
    this.setData({ favOpen: false });
    const open = (this.data.cards || []).findIndex((c) => c.title === t);
    if (open >= 0) this.setData({ open });
  },

  // 从收藏抽屉里直接取消收藏
  unfavFromDrawer(e) {
    const t = e.currentTarget.dataset.t;
    if (!t) return;
    let favs = wx.getStorageSync('hb_stFavs') || [];
    favs = favs.filter((x) => x !== t);
    wx.setStorageSync('hb_stFavs', favs);
    this.setData({ favTitles: favs, favList: favs.map((f) => (this._allCards || this.data.cards).find((c) => c.title === f)).filter(Boolean) });
    this.applyFavs();
    wx.showToast({ title: '已取消收藏', icon: 'none' });
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
    this.setData({ newCount: (this._allCards || []).filter((c) => !reads0[c.title]).length, stReads: reads0 });
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
    this.fetchLastMood(); // 最近心情 → 推荐 3 张卡
    // 今日已读计数（当天展开次数，温柔鼓励）
    this.setData({ todayReads: this.todayStationReads() });
  },

  // 今日已展开过的卡片数（本地按天累计）
  todayStationReads() {
    const day = wx.getStorageSync('hb_stReadDay') || {};
    const k = new Date().toDateString();
    return (day[k] || 0);
  },

  setCardTag(e) {
    const t = e.currentTarget.dataset.t;
    this.setData({ showTag: t, open: -1 });
    this.applyFavs();
  },

  // 读最近一次心情（云端 moods），按情绪映射关键词，推荐 3 张卡（安静，不影响主体）
  async fetchLastMood() {
    try {
      let openid = app.globalData.openid;
      if (!openid) openid = await app.login();
      if (!openid) return;
      const db = wx.cloud.database();
      const res = await db.collection('moods').where({ openid }).orderBy('createdAt', 'desc').limit(1).get();
      const m = (res.data || [])[0];
      if (!m) return;
      const SCORE = { happy: 5, ok: 4, flat: 3, low: 2, very_low: 1 };
      const sc = SCORE[m.mood] !== undefined ? SCORE[m.mood] : 3;
      let tag = '';
      if (sc <= 2) tag = '难过';
      else if (sc === 3) tag = '焦虑';
      else tag = '平静';
      const hits = this._allCards
        .map((c, i) => ({ c, i }))
        .filter((x) => (x.c.tags || []).includes(tag))
        .slice(0, 3)
        .map((x) => ({ index: x.i, title: x.c.title }));
      if (hits.length) this.setData({ recMood: m.mood === 'calm' ? '平静' : (tag === '难过' ? '低落' : tag), recCards: hits });
    } catch (err) { /* 云端不可用时静默 */ }
  },
  openRec(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    if (!Number.isFinite(idx) || idx < 0) return;
    this.toggleCard({ currentTarget: { dataset: { index: String(idx) } } });
  },

  toggleCard(e) {
    const i = Number(e.currentTarget.dataset.index);
    // 一句话速读：开启时点卡片只看核心一句（toast 即可带走），不展开全文
    if (this.data.quickRead) {
      const c = (this.data.cards || [])[i];
      if (c) {
        const reads = wx.getStorageSync('hb_stReads') || {};
        reads[c.title] = (reads[c.title] || 0) + 1;
        wx.setStorageSync('hb_stReads', reads);
        const day = wx.getStorageSync('hb_stReadDay') || {};
        const k = new Date().toDateString();
        day[k] = (day[k] || 0) + 1;
        wx.setStorageSync('hb_stReadDay', day);
        this.setData({ todayReads: day[k] });
        const first = (c.lines && c.lines[0]) || c.title;
        wx.showToast({ title: first, icon: 'none', duration: 2600 });
      }
      return;
    }
    const willOpen = this.data.open !== i;
    if (willOpen) {
      // 阅读计数：展开即读（本地，用于了解自己最常翻哪张）
      const c = (this.data.cards || [])[i];
      if (c) {
        const reads = wx.getStorageSync('hb_stReads') || {};
        reads[c.title] = (reads[c.title] || 0) + 1;
        wx.setStorageSync('hb_stReads', reads);
        // 今日已读计数（同一天内每张只算一次）
        const day = wx.getStorageSync('hb_stReadDay') || {};
        const k = new Date().toDateString();
        day[k] = (day[k] || 0) + 1;
        wx.setStorageSync('hb_stReadDay', day);
        this.setData({ todayReads: day[k] });
      }
    }
    this.setData({ open: willOpen ? i : -1 });
    // 展开时顺手推荐同主题卡（未读优先，最多 2 张）——「一起充电」
    if (willOpen) this.setLikeCards(i);
    else this.setData({ likeCards: [] });
  },

  // 「一起充电」：同标签的其它卡，还没看过的排前面（读得多更懂你要什么）
  setLikeCards(i) {
    const c = (this.data.cards || [])[i];
    if (!c) return;
    const reads = wx.getStorageSync('hb_stReads') || {};
    const same = (this.data.cards || []).filter((x, j) => j !== i && (x.tags || []).some((t) => (c.tags || []).includes(t)));
    // 未读优先，其次同标签数量多者优先；最多 2 张，且排除当前卡
    const like = same.sort((a, b) => {
      const wa = reads[a.title] ? 1 : 0, wb = reads[b.title] ? 1 : 0;
      if (wa !== wb) return wa - wb;       // 未读(0) 在前
      const ta = (b.tags || []).filter((t) => (c.tags || []).includes(t)).length;
      const tb = (a.tags || []).filter((t) => (c.tags || []).includes(t)).length;
      return ta - tb;                       // 重合标签更多者靠前
    }).slice(0, 3);
    this.setData({
      likeCards: like.map((x) => ({ title: x.title, emoji: x.emoji, tags: (x.tags || []).join('·'), index: (this.data.cards || []).findIndex((cc) => cc.title === x.title) }))
    });
  },

  // 点「一起充电」推荐卡：直接展开它，并重新推荐
  openLikeCard(e) {
    const idx = Number(e.currentTarget.dataset.index);
    if (!(idx >= 0)) return;
    this.toggleCard({ currentTarget: { dataset: { index: String(idx) } } });
  },

  goHelper() {
    wx.switchTab({ url: '/pages/helper/helper' });
  },

  // 随机抽一张：不知道做什么时，让今天「抽」到你（展开随机卡片）
  randomCard() {
    const cards = this.data.cards || [];
    if (!cards.length) return;
    // 今天抽到过的先不立刻重复（本地记录当天抽过的标题）
    const today = new Date().toDateString();
    const pool = this.data.drawPool || wx.getStorageSync('hb_stDrawPool') || {};
    let drawnToday = (pool[today] || []).slice();
    const avail = cards.filter((x) => drawnToday.indexOf(x.title) < 0);
    const src = avail.length ? avail : cards;
    const i = Math.floor(Math.random() * src.length);
    const c = src[i];
    // 抽中计数：第 N 次抽到同一张，说明它跟你有缘
    const cnt = wx.getStorageSync('hb_stDraws') || {};
    cnt[c.title] = (cnt[c.title] || 0) + 1;
    wx.setStorageSync('hb_stDraws', cnt);
    // 记住今天的抽取（保持 ≤8 条，跨天自然失效）
    if (!drawnToday.includes(c.title)) {
      if (drawnToday.length >= 8) drawnToday = drawnToday.slice(drawnToday.length - 7);
      drawnToday.push(c.title);
    }
    pool[today] = drawnToday;
    wx.setStorageSync('hb_stDrawPool', pool);
    // 顺手推荐另一张（不同的卡），点一下直接展开
    const others = src.filter((x, j) => j !== i);
    const other = others.length ? others[Math.floor(Math.random() * others.length)] : null;
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
  // 卡片建议直达：不同卡带一个小动作（去做 / 去学 / 去记一笔）
  goAct(e) {
    const k = e.currentTarget.dataset.act;
    const map = {
      breathe: ['/pages/breathe/breathe', '去呼吸'],
      scan: ['/pages/scan/scan', '去扫描'],
      mood: ['/pages/mood/mood', '去记一笔'],
      edu: ['/pages/edu/edu', '去小课'],
      chat: ['/pages/chat/chat', '去说一说']
    };
    const t = map[k];
    if (!t) return;
    wx.navigateTo({ url: t[0] });
    if (k === 'mood') wx.showToast({ title: '去记一笔今天的心情 🎨', icon: 'none' });
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