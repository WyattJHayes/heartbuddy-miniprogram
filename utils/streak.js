// 连续天数计算（本地日期队列 → 从今天/昨天往前连续计数）
// 用于：心理小课连续学习天数、徽章「连学 7 天」等
function calcStreak(days) {
  const set = new Set(days || []);
  if (!set.size) return 0;
  const today = new Date().toDateString();
  const yest = new Date(Date.now() - 86400000).toDateString();
  if (!set.has(today) && !set.has(yest)) return 0;
  let n = 0;
  let cur = set.has(today) ? new Date() : new Date(Date.now() - 86400000);
  for (let i = 0; i < 730; i++) {
    if (set.has(cur.toDateString())) { n++; cur = new Date(cur.getTime() - 86400000); }
    else break;
  }
  return n;
}

module.exports = { calcStreak };