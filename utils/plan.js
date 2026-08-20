// utils/plan.js —— 3 天自评陪伴计划（纯本地，无网络）
// 由测评结果按焦虑水平生成 3 天小任务，跨「测评页/心情页」共享同一份计划。

const PLANS = {
  low: {
    label: '轻量放松版',
    days: [
      { n: 1, title: '睡前 5 分钟慢呼吸', desc: '找个安静的地方：吸气 4 秒、屏住 4 秒、呼气 6 秒，重复 5 轮。' },
      { n: 2, title: '记录一件小确幸', desc: '在心情页一键记下今天让你安心或微笑的一件小事。' },
      { n: 3, title: '和一个人说句话', desc: '把这几天的感受，挑一句说给信任的人听。' }
    ]
  },
  mid: {
    label: '舒缓陪伴版',
    days: [
      { n: 1, title: '给压力写“快递单”', desc: '把最烦的三件事写在纸上，给每个标一个“着急/不着急”。' },
      { n: 2, title: '今天只做一件小事', desc: '把大目标拆成今天能完成的一件小步骤，做完就夸自己。' },
      { n: 3, title: '预约一个“说出来的时刻”', desc: '和老师/家长/朋友约好十分钟的聊天，把心事说出来。' }
    ]
  },
  high: {
    label: '双通道陪伴版',
    days: [
      { n: 1, title: '先让自己“落地”', desc: '把注意力放在脚下和呼吸上，做 10 轮慢呼吸；必要时拨打 12356。' },
      { n: 2, title: '今天一定要找一个人', desc: '把真实感受告诉信任的人，或去求助页拨打热线，别独自硬扛。' },
      { n: 3, title: '稳妥地照护自己', desc: '记录今天的情绪，给自己安排一顿好好吃的饭、早点睡觉。' }
    ]
  }
};

// 焦虑文案标签 → 计划 key
const LEVEL_KEY = { '低': 'low', '中度': 'mid', '偏高': 'high' };

// 新建一份计划（锚定开始日期）
function build(levelLabel) {
  const key = LEVEL_KEY[levelLabel] || 'low';
  const p = PLANS[key];
  return {
    key,
    label: p.label,
    startTs: Date.now(),
    days: p.days.map((d) => ({ ...d })),
    done: [false, false, false]
  };
}

// 根据开始时间算出“今天”落在计划的第几天：0/1/2 或 -1(未开始)/3(已结束)
function activeIndex(plan) {
  if (!plan) return -1;
  const sd = startOfDay(plan.startTs);
  const now = startOfDay(Date.now());
  const diff = Math.floor((now - sd) / 86400000);
  if (diff < 0) return -1;
  if (diff >= plan.days.length) return plan.days.length;
  return diff;
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// 保存前做一次“今天该打哪一版卡”的自动检查：过期/未到的打不了
function sanitize(plan) {
  if (!plan) return plan;
  const idx = activeIndex(plan);
  return {
    ...plan,
    done: plan.done.map((v, i) => (i === idx ? v : (i < idx ? true : v)))
  };
}

// 读取并做“今天该打哪一版卡”的自动修正
function load(storageKey) {
  const plan = sanitize(wx.getStorageSync(storageKey || 'companionPlan'));
  if (plan) wx.setStorageSync(storageKey || 'companionPlan', plan);
  return plan;
}

module.exports = { PLANS, build, activeIndex, sanitize, load };