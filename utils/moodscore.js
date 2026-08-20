// 情绪 → 分值（1–5，用于折线图纵轴）
module.exports = {
  MOOD_SCORE: { happy: 5, peace: 4, expect: 4.5, angry: 3, tired: 2.5, anxiety: 2, lonely: 1.5, sad: 1 },
  MOOD_META: {
    happy: { emoji: '😊', label: '开心' },
    peace: { emoji: '😌', label: '平静' },
    anxiety: { emoji: '😰', label: '焦虑' },
    sad: { emoji: '😢', label: '难过' },
    expect: { emoji: '🌟', label: '期待' },
    lonely: { emoji: '🌫', label: '孤独' },
    tired: { emoji: '😴', label: '疲惫' },
    angry: { emoji: '😡', label: '生气' }
  }
};