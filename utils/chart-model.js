// utils/chart-model.js —— 折线图布局纯函数（被 emotion-chart 与 tools 单测共享）
// 不依赖 wx/canvas，可被 Node 直接 require，避免图形逻辑只靠人工目测

// 第 i 个点的横坐标（n=1 时居中）
function pointX(i, n, padL, plotW) {
  return padL + plotW * (n === 1 ? 0.5 : i / (n - 1));
}

// 分值 v 的纵坐标（min→底，max→顶）
function pointY(v, min, max, padT, plotH) {
  const span = max - min || 1;
  return padT + plotH * (1 - (v - min) / span);
}

// 网格线纵轴刻度值（默认 5 档：min..max 均分）
function gridValues(min, max) {
  const span = max - min || 1;
  const steps = 4;
  const out = [];
  for (let s = 0; s <= steps; s += 1) {
    out.push(min + (span * s) / steps);
  }
  return out;
}

function widthOf(measure, s) {
  const r = measure(s);
  return typeof r === 'number' ? r : r.width;
}

// 按 maxWidth 换行截断为至多 maxLines 行；截断时末行补省略号
function clipLines(text, maxWidth, maxLines, measure) {
  if (!text) return [];
  const chars = Array.from(String(text));
  const w = (s) => widthOf(measure, s);
  const lines = [];
  let line = '';
  let i = 0;
  for (; i < chars.length; i++) {
    const candidate = line + chars[i];
    if (line && w(candidate) > maxWidth) {
      lines.push(line);
      line = chars[i];
      if (lines.length === maxLines - 1) break;
    } else {
      line = candidate;
    }
  }
  const truncated = i < chars.length;
  if (line) lines.push(line);
  while (lines.length > maxLines) lines.pop();
  if (truncated && lines.length) {
    const lastChars = Array.from(lines[lines.length - 1]);
    const kept = lastChars.slice(0, Math.max(1, lastChars.length - 1)).join('');
    lines[lines.length - 1] = kept + '…';
  }
  return lines;
}

// 近 n 天每日一条（value 默认 null），label 可自定义
function lastNDays(n, now, labelOf) {
  const DAY = 24 * 60 * 60 * 1000;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const ts = new Date(today.getTime() - i * DAY);
    out.push({
      label: labelOf ? labelOf(ts) : defaultLabel(ts),
      value: null,
      key: ts.toDateString()
    });
  }
  return out;
}

function defaultLabel(ts) {
  const pad = (x) => (x < 10 ? '0' + x : x);
  return `${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}`;
}

module.exports = { pointX, pointY, gridValues, clipLines, lastNDays, defaultLabel };