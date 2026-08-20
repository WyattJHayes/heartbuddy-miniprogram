// cloudfunctions/aiChat/danger.js —— 危机关键词安全分级（本地兜底+分级）
// 说明：LLM 判断为主，本地规则作为第二道防线；分级用于决定前端的交互强度。

const LEVEL_WORDS = {
  high: [
    '自杀', '自残', '割腕', '跳楼', '跳桥', '轻生', '不想活', '想死',
    '活不下了', '活不下去', '结束生命', '伤害自己', '想离开这个世界', '想消失不见自己'
  ],
  mid: [
    '撑不住', '坚持不住', '受不了', '没有意义', '毫无意义', '绝望了',
    '崩溃了', '忍不住想哭', '想逃离', '消失算了'
  ],
  low: [
    '难受', '难过', '害怕', '焦虑', '睡不着', '失眠', '烦躁', '压力大', '想哭',
    '心慌', '紧张', '累', '委屈', '低落'
  ]
};

const SCORE = { high: 3, mid: 2, low: 1 };

/**
 * 分析一段文本的危机等级
 * @returns {{level: ('high'|'mid'|'low'|null), keywords: string[]}}
 */
function analyze(text) {
  const t = String(text || '');
  const hits = [];
  let level = null;
  ['high', 'mid', 'low'].forEach((lv) => {
    if (level) return; // 已定更高等级
    for (const w of LEVEL_WORDS[lv]) {
      if (t.includes(w)) {
        hits.push(w);
        level = lv;
        break;
      }
    }
  });
  return { level, keywords: hits };
}

module.exports = { analyze, LEVEL_WORDS, SCORE };