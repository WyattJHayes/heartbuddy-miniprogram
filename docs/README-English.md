# Heartbuddy（心语伴）· AI Emotional Companion Mini Program

<p align="center"><img src="../assets/banner.svg" alt="Heartbuddy banner" width="100%"></p>

> Entry for the **2026 WeChat Mini Program Development Competition** — track: *AI + Mental Wellness / Emotional Companion* (niche: pre-exam anxiety for students).
> Tech stack: native WeChat Mini Program + WeChat CloudBase (Cloud Functions & Cloud DB) + an OpenAI-compatible LLM.

## ✨ Features

| Module | Description |
|---|---|
| 💬 Companion | Multi-turn empathetic AI chat (streaming typewriter). Optionally tag your current mood. |
| 🌱 Mood | Mood journaling & visualization (proportion bars + recent history). |
| 📝 Weekly Report | One-tap "this week's emotional digest" with tailored advice + **canvas share card** (save / forward, light & dark templates). |
| 📋 Assessment | 7 self-written items (GAD-7 style) for pre-exam anxiety → result + advice, auto-injected into subsequent chat context. |
| 📊 Dashboard | Ops analytics via cloud function (users / chats / crisis levels / 7-day activity). |
| 🆘 Help | One-tap crisis hotlines + permanent "you can always call 12356" card. |
| ⚠️ Crisis Safety | Triple-level response: 🔴 high → help-page modal · 🟠 mid → gentle guide · 🟡 low → unobtrusive. Independent `crisisAlerts` records. |

**Crisis safety** is implemented with double defense: the LLM outputs a structured JSON crisis marker, while `cloudfunctions/aiChat/danger.js` performs local keyword fallback — merging both and taking the highest level. Even if the LLM fails, the local rules still return a help pointer.

## 🚀 Quick Start (~30 min)

Full step-by-step guide (Chinese) in **[docs/部署运维手册.md](../docs/部署运维手册.md)**.

1. Register a Mini Program at [mp.weixin.qq.com](https://mp.weixin.qq.com) and get your **AppID**.
2. In WeChat DevTools, import this folder. Replace `appid` in `project.config.json`.
3. Enable **Cloud Development** (basic free tier is enough), create collections:
   `users` / `moods` / `assessments` / `crisisAlerts` / `feedbacks` — permission "only creator can read/write".
4. Configure the LLM (OpenAI-compatible). Recommended: env vars on the `aiChat` cloud function:
   `LLM_API_KEY`, `LLM_BASE_URL` (e.g. `https://api.deepseek.com/v1`), `LLM_MODEL` (e.g. `deepseek-chat`).
5. Upload & deploy cloud functions (`login`, `aiChat`, `opsSummary` — "cloud install dependencies"). Optionally whitelist your openid in `opsSummary/index.js` (`ADMIN_OPENIDS`).

The phone remember: *msgSecCheck* (WeChat content-safety) is already wired in `aiChat/secure.js`; enable the API permission in mp.weixin.qq.com before publishing — it degrades gracefully (logs & continues) until then.

## 🧪 Self-Test Checklist

- [ ] First launch shows the privacy consent screen
- [ ] "Companion" page: send a message → streaming AI reply
- [ ] Mood page shows the tagged emotion after chatting
- [ ] Assessment (7 questions) → result screen
- [ ] Weekly Report → generate share card → save/share (light + dark)
- [ ] (Test only) type an expression like "I feel like giving up" → soft guidance appears
- [ ] Dashboard shows stats for your openid
- [ ] Help page: one-tap dial works

## 🗂 Structure

```
heartbuddy-miniprogram/
├── app.js/app.json/app.wxss      # global
├── config/index.js               # hotlines + quick replies
├── utils/api.js                  # cloud-function wrapper
├── pages/  welcome | chat | mood | assessment | ops | report | helper | privacy | profile
├── cloudfunctions/
│   ├── login/        silent login (writes users)
│   ├── aiChat/       chat + mood + crisis (prompt / danger / secure)
│   └── opsSummary/   ops aggregation (ADMIN_OPENIDS whitelist)
├── assets/   banner + share-card previews (light / dark)
└── docs/     speech script · submission checklist · judge Q&A · deploy manual
```

## 🛡 Safety & Privacy

- AI is positioned as an **emotional companion, not a medical service** — no diagnosis / treatment claims anywhere.
- Chat text never touches the database; only mood tags, assessment scores and crisis timestamps/levels (anonymized) are stored.
- Full privacy policy available in-app (`pages/privacy`) and Chinese user notice modal on first launch.
- Crisis records are logged separately so operators can follow up (ops dashboard shows open high-risk counts).

## 🧩 Open-Source Notes

- The conversation UI is open to reuse of [Tencent CloudBase Agent UI](https://github.com/TencentCloudBase/cloudbase-agent-ui) (Apache-2.0).
- Psychological item structures may borrow from [wzy-xl](https://github.com/bonyren/wzy-xl) — mind its License and item copyrights (we use original self-written items).

For the Chinese README with screenshots and full docs, see **[README.md](../README.md)**.