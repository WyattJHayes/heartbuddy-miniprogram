// 情绪 → 分值（1–5，用于折线图纵轴）
module.exports = {
  MOOD_SCORE: { happy: 5, peace: 4, angry: 3, anxiety: 2, lonely: 1.5, sad: 1 },
  MOOD_META: {
    happy: { emoji: '😊', label: '开心' },
    peace: { emoji: '😌', label: '平静' },
    anxiety: { emoji: '😰', label: '焦虑' },
    sad: { emoji: '😢', label: '难过' },
    lonely: { emoji: '🌫', label: '孤独' },
    angry: { emoji: '😡', label: '生气' }
  }
};