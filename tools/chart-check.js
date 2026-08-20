#!/usr/bin/env node
// tools/chart-check.js —— 制图布局纯函数单测（node 直接运行，CI 内执行）
// 校验 X/Y 映射、网格刻度、换行截断与近 N 天序列，防止图形逻辑悄悄退化。
'use strict';

const model = require('../utils/chart-model');
const assert = require('assert');

let passed = 0;
function t(name, fn) {
  fn();
  passed += 1;
  console.log('  ✔ ' + name);
}

console.log('chart-model 自检');

// 1) 点横坐标：首尾贴边，中间等分
t('pointX 首尾/中段', () => {
  assert.strictEqual(model.pointX(0, 7, 30, 100), 30);
  assert.strictEqual(model.pointX(6, 7, 30, 100), 130);
  assert.strictEqual(model.pointX(3, 7, 30, 100), 80);
  assert.strictEqual(model.pointX(0, 1, 30, 100), 80); // 单点时居中
});

// 2) 纵坐标：min→底，max→顶，单向不减
t('pointY 映射', () => {
  assert.strictEqual(model.pointY(1, 1, 5, 20, 100), 120);
  assert.strictEqual(model.pointY(5, 1, 5, 20, 100), 20);
  assert.strictEqual(model.pointY(3, 1, 5, 20, 100), 70);
  const y = model.pointY(2.7, 1, 5, 20, 100);
  assert.ok(y > 20 && y < 120 && Number.isFinite(y));
});

// 3) 网格刻度：5 档均分含两端
t('gridValues 5 档', () => {
  assert.deepStrictEqual(model.gridValues(1, 5), [1, 2, 3, 4, 5]);
  assert.deepStrictEqual(model.gridValues(0, 2), [0, 0.5, 1, 1.5, 2]);
});

// 4) 换行截断
t('clipLines 换行/截断', () => {
  // 量宽 = 每字符 10px，最多 3 行、每行 8 字符
  const m = (s) => s.length * 10;
  const twoLines = model.clipLines('今天是周三，整体平稳，继续保持', 80, 2, m);
  assert.ok(twoLines.length <= 2, '不应超过 maxLines');
  assert.ok(twoLines[twoLines.length - 1].indexOf('…') > -1, '截断时应带省略号');
  const one = model.clipLines('短句', 80, 2, m);
  assert.deepStrictEqual(one, ['短句']);
  const empty = model.clipLines('', 80, 2, m);
  assert.deepStrictEqual(empty, []);
});

// 5) 近 7 天序列：key 去重、label 生成、含今天倒推
t('lastNDays(7) 序列', () => {
  const now = new Date('2026-08-20T12:00:00');
  const days = model.lastNDays(7, now.getTime(), (ts) => model.defaultLabel(ts));
  assert.strictEqual(days.length, 7);
  assert.strictEqual(new Set(days.map((d) => d.key)).size, 7, 'key 应唯一');
  assert.strictEqual(days[0].label, '08-14');
  assert.strictEqual(days[6].label, '08-20');
  assert.ok(days.every((d) => d.value === null));
});

// 6) 与 emotion-chart 参数吻合：grid 高度 padding 内不越界
t('边界：刻度不越出绘图区', () => {
  const [lo, hi] = [1, 5];
  for (let v = lo; v <= hi; v += 0.25) {
    const y = model.pointY(v, lo, hi, 22, 120);
    assert.ok(y >= 22 && y <= 142, `y=${y} 越界`);
  }
});

console.log(`\n✓ 全部通过：${passed} 项`);
process.exit(0);