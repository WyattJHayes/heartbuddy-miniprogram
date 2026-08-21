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
  // 月份对比：本月 / 上月 的危机预警数与已处理数
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth();
  const monthStart = new Date(y, mo, 1).getTime();
  const lastMonthStart = new Date(y, mo - 1, 1).getTime();
  const dayStart = new Date(y, mo, now.getDate()).getTime();

  try {
    const [users, moods, assessments, crisisTotal, crisisWeek, moodWeek, activeUsers, openHigh, openCrisis, handledCrisis, weekHandled, highWeek, monthCrisis, monthHandled, lastCrisis, lastHandled, todayCrisis, todayLatest, recentFeeds] =
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
        db.collection('crisisAlerts').where({ level: 'high', createdAt: _.gte(weekAgo) }).limit(200).get(),
        db.collection('crisisAlerts').where({ createdAt: _.gte(monthStart) }).count(),
        db.collection('crisisAlerts').where({ createdAt: _.gte(monthStart), status: 'handled' }).count(),
        db.collection('crisisAlerts').where({ createdAt: _.gte(lastMonthStart), createdAt: _.lt(monthStart) }).count(),
        db.collection('crisisAlerts').where({ createdAt: _.gte(lastMonthStart), createdAt: _.lt(monthStart), status: 'handled' }).count(),
        // 今日新增危机计数 + 今日最新一条（危机快报）
        db.collection('crisisAlerts').where({ createdAt: _.gte(dayStart) }).count(),
        db.collection('crisisAlerts').where({ createdAt: _.gte(dayStart) }).orderBy('createdAt', 'desc').limit(1).get(),
        // 用户反馈流：最新 5 条（运营闭环）
        db.collection('feedbacks').orderBy('createdAt', 'desc').limit(5).get()
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
    const highHandledByDay = {};
    const highUsers = {};
    (highWeek.data || []).forEach((c) => {
      const d = new Date(c.createdAt);
      const key = `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`;
      highByDay[key] = (highByDay[key] || 0) + 1;
      if (c.status === 'handled') highHandledByDay[key] = (highHandledByDay[key] || 0) + 1;
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
    // 近 7 日高危处理率趋势（预警日 → 当日已处理比例，运营量化）
    const highRate7 = (function () {
      const out = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const key = `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`;
        const total = highByDay[key] || 0;
        const done = highHandledByDay[key] || 0;
        out.push({ day: key, total, handled: done, rate: total ? Math.round((done / total) * 100) : null });
      }
      return out;
    })();
    const highLastAt = {};
    (highWeek.data || []).forEach((c) => {
      if (c.openid) {
        const at = Number(c.createdAt) || 0;
        if (at > (highLastAt[c.openid] || 0)) highLastAt[c.openid] = at;
      }
    });
    const fmtShort = (t) => {
      if (!t) return '';
      const d = new Date(t);
      return d.getMonth() + 1 + '月' + d.getDate() + '日 ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    };
    const highUserList = Object.keys(highUsers)
      .sort((a, b) => highUsers[b] - highUsers[a])
      .slice(0, 6)
      .map((o) => ({ openid: o, short: o.slice(0, 6) + '…', count: highUsers[o], lastAt: fmtShort(highLastAt[o]) }));

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
        // 月对比：本月 vs 上月（预警数/已处理/处理率在前端算）
        monthCrisis: monthCrisis.total,
        monthHandled: monthHandled.total,
        lastCrisis: lastCrisis.total,
        lastHandled: lastHandled.total,
        // 危机快报：今日新增数 + 今日最新一条摘要
        todayCrisis: todayCrisis.total,
        latestCrisis: ((todayLatest.data || [])[0] || null)
          ? {
              keywords: (todayLatest.data[0].keywords || '') || (todayLatest.data[0].aiSummary || ''),
              level: todayLatest.data[0].level || '',
              time: new Date(todayLatest.data[0].createdAt).toLocaleString('zh-CN', { hour12: false })
            }
          : null,
        moodTrend7,
        crisisBySource: Object.keys(bySource).map((k) => ({ source: k, count: bySource[k] })),
        highTrend7,
        highRate7,
        highUserList,
        recentCrisis: (crisisWeek.data || []).slice(0, 10).map((c) => ({
          id: c._id,
          level: c.level,
          keywords: c.keywords || '',
          status: c.status || 'open',
          time: new Date(c.createdAt).toLocaleString('zh-CN', { hour12: false })
        })),
        // 用户反馈流（脱敏，就近展示最近 5 条）
        recentFeeds: (recentFeeds.data || []).map((f) => ({
          id: f._id,
          comment: (f.comment || '').slice(0, 60),
          full: f.comment || '',
          time: new Date(f.createdAt).toLocaleString('zh-CN', { hour12: false }),
          status: f.status || 'open'
        }))
      }
    };
  } catch (e) {
    console.error('[opsSummary] 失败', e);
    return { ok: false, admin: true, data: null, error: String((e && e.message) || e) };
  }
};