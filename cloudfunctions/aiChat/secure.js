// cloudfunctions/aiChat/secure.js —— 微信官方内容安全检测（msgSecCheck）
// 作用：拦截涉政/色情/暴力等违规内容，不进入大模型。
// 注意：接口权限未开通时**自动降级放行**，绝不因安全检查故障而阻断正常用户服务。
const cloud = require('wx-server-sdk');

/**
 * 对一段文本做 msgSecCheck（v2）
 * @param {string} content 用户输入
 * @param {string} openid  用户 openid（从 getWXContext 取）
 * @returns {{ pass: boolean, risky: boolean, degraded?: boolean, label?: number, suggest?: string }}
 */
async function check({ content = '', openid = '' }) {
  const text = String(content).slice(0, 2000); // v2 接口正文上限附近留余量

  if (!text.trim()) return { pass: true, risky: false };

  try {
    const res = await cloud.openapi.security.msgSecCheck({
      version: 2,
      scene: 2, // 2=评论
      openid,
      content: text
    });
    const suggest = (res && res.result && res.result.suggest) || 'pass';
    const risky = suggest === 'risky';
    return { pass: !risky, risky, suggest };
  } catch (e) {
    // 常见：接口未开通（-501000/-601011/-604101）、无权限、环境未配置
    // 一律降级放行 + 记录日志，方便控制台排查
    console.warn('[msgSecCheck] 降级放行', e && e.errCode, e && e.errMsg);
    return { pass: true, risky: false, degraded: true };
  }
}

// 命中违规时给用户的中立回应（不进入大模型）
const BLOCKED_REPLY =
  '为了让大家都能安全、友善地交流，这句话我就不接啦。如果心里有郁结，随时可以和我聊聊最近的心情，我都在。';

module.exports = { check, BLOCKED_REPLY };