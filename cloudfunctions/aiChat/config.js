// cloudfunctions/aiChat/config.js —— 大模型配置
// 强烈建议把 key 放进云函数「环境变量」而不是写死在代码里：
//   云开发控制台 -> 云函数 -> aiChat -> 配置 -> 环境变量
module.exports = {
  // 支持任意 OpenAI 兼容 Chat Completions 接口
  apiKey: process.env.LLM_API_KEY || 'sk-你的Key',
  baseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1/chat/completions',
  model: process.env.LLM_MODEL || 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 400,
  enabled: true
};