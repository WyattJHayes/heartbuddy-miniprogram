// cloudfunctions/opsHandleCrisis/index.js —— 运营闭环：把危机标记为已处理
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 👉 与 opsSummary 保持同一白名单
const ADMIN_OPENIDS = [''];

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!ADMIN_OPENIDS.includes(OPENID)) {
    return { ok: false, admin: false, error: '无权限' };
  }
  const { id } = event || {};
  if (!id) return { ok: false, admin: true, error: '缺少危机记录 id' };

  try {
    const res = await db.collection('crisisAlerts').doc(id).update({
      data: {
        status: 'handled',
        handledAt: db.serverDate(),
        handledBy: OPENID
      }
    });
    if (!res.stats || !res.stats.updated) {
      return { ok: false, admin: true, error: '未找到该记录或已删除' };
    }
    return { ok: true, admin: true };
  } catch (e) {
    console.error('[opsHandleCrisis] 失败', e);
    return { ok: false, admin: true, error: String(e && e.message || e) };
  }
};