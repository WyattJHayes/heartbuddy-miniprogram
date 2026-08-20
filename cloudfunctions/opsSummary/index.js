// cloudfunctions/opsSummary/index.js —— 运营数据汇总（演示看板用）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 👉 把你自己的 openid 填进白名单，看板才会显示数据
const ADMIN_OPENIDS = [''];

// 情绪分值映射（与 utils/moodscore.js 保持一致）
const SCORE = { happy: 5, peace: 4, angry: 3, anxiety: 2, lonely: 1.5, sad: 1 };

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!ADMIN_OPENIDS.includes(OPENID)) {
    return { ok: false, admin: false, data: null };
  }

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;

  try {
    const [users, moods, assessments, crisisTotal, crisisWeek, moodWeek, activeUsers, openHigh, openCrisis, handledCrisis, weekHandled, highWeek] =
      await Promise.all([
        db.collection('users').count(),
        db.collection('moods').count(),
        db.collection('assessments').count(),
        db.collection('crisisAlerts').count(),
        db.collection('crisisAlerts').where({ createdAt: _.gte(weekAgo) }).limit(50).get(),
        db.collection('moods').where({ createdAt: _.gte(weekAgo) }).limit(300).get(),
        db.collection('users').where({ lastChatAt: _.gte(weekAgo) }).count(),
        db.collection('crisisAlerts').where({ level: 'high', status: 'open' }).count(),
        db.collection('crisisAlerts').where({ status: 'open' }).count(),
        db.collection('crisisAlerts').where({ status: 'handled' }).count(),
        db.collection('crisisAlerts').where({ status: 'handled', handledAt: _.gte(weekAgo) }).count(),
        db.collection('crisisAlerts').where({ level: 'high', createdAt: _.gte(weekAgo) }).limit(200).get()
      ]);

    const byLevel = { high: 0, mid: 0, low: 0 };
    const bySource = {};
    (crisisWeek.data || []).forEach((c) => {
      if (byLevel[c.level] !== undefined) byLevel[c.level] += 1;
      const s = c.source || 'chat';
      bySource[s] = (bySource[s] || 0) + 1;
    });

    // 7 日情绪均值趋势（按天聚合，仅含当天有记录的日期）
    const byDay = {};
    (moodWeek.data || []).forEach((m) => {
      if (!m.createdAt || SCORE[m.mood] === undefined) return;
      const d = new Date(m.createdAt);
      const key = `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`;
      byDay[key] = byDay[key] || { sum: 0, n: 0 };
      byDay[key].sum += SCORE[m.mood];
      byDay[key].n += 1;
    });
    const moodTrend7 = Object.keys(byDay)
      .sort()
      .map((k) => ({ day: k, avg: +(byDay[k].sum / byDay[k].n).toFixed(1), n: byDay[k].n }));

    // 高危 7 天分日趋势（含 0 天补齐）+ 高危用户 top（脱敏）
    const highByDay = {};
    const highUsers = {};
    (highWeek.data || []).forEach((c) => {
      const d = new Date(c.createdAt);
      const key = `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`;
      highByDay[key] = (highByDay[key] || 0) + 1;
      if (c.openid) highUsers[c.openid] = (highUsers[c.openid] || 0) + 1;
    });
    const highTrend7 = (function () {
      const out = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const key = `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`;
        out.push({ day: key, count: highByDay[key] || 0 });
      }
      return out;
    })();
    const highUserList = Object.keys(highUsers)
      .sort((a, b) => highUsers[b] - highUsers[a])
      .slice(0, 6)
      .map((o) => ({ openid: o, short: o.slice(0, 6) + '…', count: highUsers[o] }));

    return {
      ok: true,
      admin: true,
      data: {
        totalUsers: users.total,
        totalChats: moods.total,
        totalAssessment: assessments.total,
        totalCrisis: crisisTotal.total,
        weekCrisis: (crisisWeek.data || []).length,
        byLevel,
        activeUsers7d: activeUsers.total,
        openHigh: openHigh.total,
        openCrisis: openCrisis.total,
        handledCrisis: handledCrisis.total,
        weekHandled: weekHandled.total,
        moodTrend7,
        crisisBySource: Object.keys(bySource).map((k) => ({ source: k, count: bySource[k] })),
        highTrend7,
        highUserList,
        recentCrisis: (crisisWeek.data || []).slice(0, 10).map((c) => ({
          id: c._id,
          level: c.level,
          keywords: c.keywords || '',
          status: c.status || 'open',
          time: new Date(c.createdAt).toLocaleString('zh-CN', { hour12: false })
        }))
      }
    };
  } catch (e) {
    console.error('[opsSummary] 失败', e);
    return { ok: false, admin: true, data: null, error: String((e && e.message) || e) };
  }
};