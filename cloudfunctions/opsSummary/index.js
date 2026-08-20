// cloudfunctions/opsSummary/index.js —— 运营数据汇总（演示看板用）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 👉 把你自己的 openid 填进白名单，看板才会显示数据
const ADMIN_OPENIDS = [''];

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!ADMIN_OPENIDS.includes(OPENID)) {
    return { ok: false, admin: false, data: null };
  }

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;

  try {
    const [users, moods, assessments, crisisTotal, crisisWeek, activeUsers] = await Promise.all([
      db.collection('users').count(),
      db.collection('moods').count(),
      db.collection('assessments').count(),
      db.collection('crisisAlerts').count(),
      db.collection('crisisAlerts').where({ createdAt: _.gte(weekAgo) }).limit(50).get(),
      db.collection('users').where({ lastChatAt: _.gte(weekAgo) }).count()
    ]);

    const byLevel = { high: 0, mid: 0, low: 0 };
    (crisisWeek.data || []).forEach((c) => {
      if (byLevel[c.level] !== undefined) byLevel[c.level] += 1;
    });

    return {
      ok: true,
      admin: true,
      data: {
        totalUsers: users.total,
        totalChats: moods.total,
        totalAssessment: assessments.total,
        totalCrisis: crisis.total,
        weekCrisis: crisisWeek.data.length,
        byLevel,
        activeUsers7d: activeUsers.total,
        recentCrisis: (crisisWeek.data || []).slice(0, 10).map((c) => ({
          level: c.level,
          keywords: c.keywords || '',
          status: c.status || 'open',
          time: new Date(c.createdAt).toLocaleString('zh-CN', { hour12: false })
        }))
      }
    };
  } catch (e) {
    console.error('[opsSummary] 失败', e);
    return { ok: false, admin: true, data: null, error: String(e && e.message || e) };
  }
};