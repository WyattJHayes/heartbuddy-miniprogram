// cloudfunctions/clearMyData/index.js —— 隐私合规：清空当前用户本人数据
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: '缺少身份' };

  try {
    // 只删当前用户自己的数据（云函数权限下 where+remove 允许）
    const targets = ['moods', 'assessments', 'crisisAlerts', 'feedbacks'];
    const removed = {};
    for (const col of targets) {
      const res = await db.collection(col).where({ openid: OPENID }).remove();
      removed[col] = (res.stats && res.stats.removed) || 0;
    }
    return { ok: true, removed };
  } catch (e) {
    console.error('[clearMyData] 失败', e);
    return { ok: false, error: String(e && e.message || e) };
  }
};