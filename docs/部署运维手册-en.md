# Deployment & Ops Guide (English condensed)

> Full Chinese guide: **[部署运维手册.md](部署运维手册.md)**. This is the quick English edition.

## 0. What you need
- A WeChat **Mini Program AppID** ([mp.weixin.qq.com](https://mp.weixin.qq.com), personal subject is fine)
- WeChat DevTools (stable channel)
- A CloudBase (微信云开发) environment — the **free/基础版 tier is enough**
- An **OpenAI-compatible LLM API key** (e.g. DeepSeek)

## 1. Import & enable cloud
1. Import the project folder into DevTools; put your real `appid` into `project.config.json`.
2. Click 云开发 → create an environment. Copy its **EnvID** (or leave `envId: ''` in `app.js` to use the default).
3. Each cloud function must set run-time env — see step 3.

## 2. Create collections
In 云开发控制台 → 数据库 create 5 collections (permission: **仅创建者可读写**):

| collection | purpose | note |
|---|---|---|
| `users` | silent-login profile | openid, createdAt |
| `moods` | mood tag per chat | openid, mood, intensity, createdAt |
| `assessments` | self-check score | openid, total, label |
| `crisisAlerts` | **crisis events (anonymized)** | openid, level, status 'open', createdAt |
| `feedbacks` | user feedback | note the **s** |

## 3. Deploy cloud functions (3)
For each of `login`, `aiChat`, `opsSummary`: 右键 → 上传并部署：云端安装依赖.

**`aiChat` env variables** (cloud fn → 配置 → 环境变量 or `config.js`):
```
LLM_API_KEY=<your key>
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
```
The repo **never** contains keys. If env vars are absent, `aiChat` reads them from `LLM_*`.

**`opsSummary` whitelist**: edit `ADMIN_OPENIDS = ['your-openid']` in `index.js` before deploying (find your openid via `login` → `users` collection).

## 4. Content-safety (msgSecCheck) — before publishing
`aiChat/secure.js` already calls WeChat's `msgSecCheck` (v2, scene 2) before processing.
- In `mp.weixin.qq.com → 开发 → 开发管理 → 接口设置` enable **内容安全 msgSecCheck**.
- Until enabled the code auto-degrades to pass-with-log (graceful, keeps working) — but enable it for real submission.

## 5. Self-test checklist
- First launch shows the privacy notice; after consent the chat page works.
- Chat → streaming reply; mood page shows the tag.
- Assessment (7 questions) → result; weekly report → share card (light/dark).
- Test-only: type a neutral crisis phrase → see soft guidance + helper page link.
- Ops dashboard (`我的 → 运营看板`) shows counts for your openid.
- Helper page: one-tap dial works; crisis flow image renders.

## 6. Common issues & fixes
| Problem | Fix |
|---|---|
| `Error: errCode -501000 errMsg ...` cloud call fails | envId mismatch; set `envId` in `app.js` or re-select env in DevTools |
| Collection not exist | create the 5 collections with creator-only permission |
| Empty AI reply / `InvalidApiKey` | check `LLM_*` env vars on the **aiChat** function config |
| `opsSummary` returns nothing | whitelist your openid in `ADMIN_OPENIDS` |
| `msgSecCheck` logs degrade | not a bug; enable the API permission before submission |

## 7. Publish
DevTools → 上传 → set version → submit review with privacy statement (in-app privacy page + settings `用户隐私保护指引`). Warm tip: keep a **neutral phrase** for any crisis demo.

For the long version: [部署运维手册.md](部署运维手册.md) (Chinese, includes 提审/隐私指引、常见报错表).