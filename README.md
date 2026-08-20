# 心语伴（Heartbuddy）—— AI 情绪陪伴小程序

> 2026 微信小程序开发大赛参赛作品 · 方向：AI + 心理健康 / 情绪陪伴（学生考前焦虑细分）
> 技术栈：微信小程序原生 + 微信云开发（云函数 / 云数据库）+ OpenAI 兼容大模型

## ✨ 功能

| 模块 | 说明 |
|---|---|
| 💬 陪伴 | AI 多轮情绪对话（流式打字机），可标记当前心情 |
| 🌱 心情 | 情绪记录与可视化（占比条 + 最近） |
| 📝 周报 | 一键生成「本周情绪小报」，含针对性建议 + **canvas 分享卡片**（可保存/转发） |
| 📋 自评 | 考前焦虑自评（7 题，GAD-7 风格自编）→ 结果与建议，并自动带入后续 AI 对话上下文 |
| 📊 看板 | 运营数据看板（云函数汇总：用户/倾诉/危机分级/近 7 天记录） |
| 🆘 求助 | 心理援助热线一键拨打 + 危机说明 |
| ⚠️ 危机分级 | 三级响应：high 高危导诊求助页 / mid 温和引导 / low 不打扰，独立落库 |

**危机安全机制**（实现于 `cloudfunctions/aiChat/danger.js`，配合 AI 双保险）：

| 等级 | 分级 | 前端响应 |
|---|---|---|
| 🔴 high | 自伤/自杀等危机表达 | 弹窗 → 一键前往求助页；`crisisAlerts` 落库以 `level=high` |
| 🟠 mid | 绝望 / 撑不下去等强痛苦 | 温和弹窗提示查看求助页 |
| 🟡 low | 一般情绪低落 | 不弹窗，AI 回复里轻提一句

## 🚀 快速开始（约 30 分钟）

### 1. 准备
- 在 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册小程序，获得 **AppID**
- 下载微信开发者工具（稳定版）

### 2. 打开项目
1. 微信开发者工具 →「导入项目」→ 选择本目录（`heartbuddy-miniprogram/`）
2. 在 `project.config.json` 把 `appid` 改为你的 AppID

### 3. 开通云开发
1. 工具栏点击 **云开发** → 开通（选基础版免费额度即可）
2. 在控制台创建以下**集合**（数据库中）：
   - `users` / `moods` / `crisisAlerts` / `assessments` / `feedbacks`
   - 每个集合权限选择：**「仅创建者可读写」**

### 4. 配置大模型
编辑 `cloudfunctions/aiChat/config.js`：
```js
apiKey: '你的大模型 API Key',
baseUrl: 'https://api.deepseek.com/v1/chat/completions',  // 或混元等 OpenAI 兼容接口
model: 'deepseek-chat',
```
> 推荐：在云开发控制台 → 云函数 → aiChat → 配置 → 环境变量 里配置 `LLM_API_KEY`，而不是写死在代码里。

### 5. 部署云函数
1. 在编辑器中右键 `cloudfunctions/login` → **上传并部署：云端安装依赖**
2. 右键 `cloudfunctions/aiChat` → **上传并部署：云端安装依赖**
3. **（可选）运营看板**：右键 `cloudfunctions/opsSummary` 同样部署；然后把 `cloudfunctions/opsSummary/index.js` 顶部的 `ADMIN_OPENIDS` 换成你自己的 openid（可在云开发控制台→用户管理里查）
4. 编译运行，完成 🎉

## 🧪 自测清单
- [ ] 首次进入出现「隐私同意」页，同意后可进主页
- [ ] 在「陪伴」页发送消息，AI 流式返回
- [ ] 在「心情」页能看到刚才的情绪记录
- [ ] 「心情」页进入「考前焦虑自评」，答完 7 题出结果
- [ ] 周报页点「生成分享卡片」，能出图并保存到相册
- [ ] 故意输入「我不想活了」**测试用**，应触发求助引导弹窗
- [ ] 「我的」→「运营看板」能看到统计数字（需部署 opsSummary + 填入自己 openid）
- [ ] 在「求助」页点击拨打，能调起系统电话

## 🗂 目录结构
```
heartbuddy-miniprogram/
├── app.js / app.json / app.wxss      # 全局
├── project.config.json               # 工具配置（改 appid）
├── config/index.js                   # 热线与快捷回复
├── utils/api.js                      # 云函数封装
├── pages/
│   ├── welcome/   隐私 & AI 说明
│   ├── chat/      核心对话页
│   ├── mood/      情绪可视化（含自评入口）
│   ├── assessment/ 考前焦虑自评（7 题）
│   ├── ops/       运营看板（演示）
│   ├── report/    周报
│   ├── helper/    求助中心
│   └── profile/   我的
├── docs/视频脚本.md                    # 参赛演示视频分镜脚本
├── docs/参赛提交自查清单.md             # 提交前逐项打勾
└── cloudfunctions/
    ├── login/     静默登录（建 users 记录）
    ├── aiChat/    对话 + 情绪 + 危机（config / prompt / danger）
    └── opsSummary/ 数据汇总（填 ADMIN_OPENIDS 白名单）
```

## 🔒 合规注意
- 定位为「情绪陪伴」，**不出现「诊断 / 治疗 / 咨询机构」等医疗属性用语**
- 对话需在隐私同意后使用；敏感语已做危机分流
- 上线前：补充完整《隐私政策》页、内容安全过滤、热线号码复核
- 代码中 LLM Key 务必走环境变量，不提交到仓库

## 🧩 开源结合（可选进阶）
- 对话 UI 可二次开发「[腾讯云开发 Agent UI](https://github.com/TencentCloudBase/cloudbase-agent-ui)」（Apache-2.0），替换自绘气泡
- 心理量表结构可参考「[为之易心理健康系统 wzy-xl](https://github.com/bonyren/wzy-xl)」（注意其 License 与量表版权）
- 中文共情提示词可参考「[MeChat 数据集](https://huggingface.co/qiuhuachuan/MeChat)」

## 📄 License
本项目为参赛 demo，仅供学习与参赛使用；若引用第三方开源组件，请遵守各自协议。