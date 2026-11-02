# Public website and bring-your-own-key AI

The standalone deployment defaults to `SITE_ACCESS_MODE=public-byok`.

- Anyone can open the website, import a clearly separated vocabulary list locally, and practice without a website password or AI key.
- AI extraction and topic generation require the visitor's own API key on each request. Public mode never loads or falls back to the operator's `OPENAI_API_KEY`, even if that environment variable remains configured.
- For an optional private deployment, set `SITE_ACCESS_MODE=private`, `SITE_PASSWORD`, and the server AI environment variables. Do not use private mode when you intend to offer public BYOK access.

## For learners

Open **Data & settings → AI service**, or choose **Open AI settings** in the import window. Settings opened from an import preserve the current material.

1. Choose OpenAI, Anthropic, or a custom provider. OpenAI and Anthropic have default endpoint, model, and protocol presets.
2. Enter your key and choose **Save AI settings**. Model and endpoint overrides are in **Advanced settings**. Saving does not spend tokens or verify account credit; the provider validates the key on an actual request.
3. Leave **Remember this device** checked to store the complete connection, including the key, in this browser's localStorage for future visits. This storage is not encrypted by the application. Use only on a personal device you trust. Uncheck it for page-memory-only use that clears on reload. **Clear key** removes the active and saved credential.
4. Return to your material or topic. The action has a notice identifying what is sent and to whom; clicking the action grants consent for that request. Saving settings alone never sends material or starts an AI request.

Keys are excluded from IndexedDB vocabulary data, JSON/CSV deck exports, URLs, and server logs. Non-secret endpoint and model preferences are kept separately. Changing providers clears the draft key so a credential is not silently reused for another provider. Saved credentials include their endpoint, so they reload as one connection.

Anthropic uses native `/v1/messages`, `x-api-key`, `anthropic-version`, and `output_config.format`. OpenAI supports Responses and Chat Completions. Custom models must support JSON Schema structured output and use a public HTTPS domain on port 443. IP-literal URLs, localhost/private destinations, query strings, embedded credentials, and redirects are blocked.

**Trust boundary:** the key and current material are sent over HTTPS to this app's backend, which forwards them to the provider you specify. The application does not persist or log keys. This is not a browser-direct or end-to-end encrypted connection to the provider; only use a website and endpoint you trust. No key is sent for status checks or local parsing.

## Implementation

- `src/ai-connection.ts`: optional remembered credentials, page-only mode, and non-secret preferences.
- `src/AiConnectionSettings.tsx`: provider presets and bilingual settings; imports use a summary and a settings dialog.
- `server/ai.ts`: per-request visitor credentials, no public server-key fallback, key-hash rate limits, and same-origin checks.
- `server/safe-upstream.ts`: validates the public HTTPS destination, rejects non-public DNS answers, pins the connection to one validated address while preserving certificate verification for the original hostname, disables redirects and socket reuse, and limits response size/time.
- Only the intended content type and Bearer header are forwarded. Visitor cookies, browser headers, and the operator's credentials are not forwarded.
- Provider errors are classified without returning raw error bodies, which could reflect credentials.

The public handler allows two concurrent AI tasks globally and up to ten requests per minute per key. Rate-limit buckets store transient SHA-256 key hashes, never the raw keys. This protects the shared service; it is not a promise of production-scale availability.

## Verify

```sh
npm test
npm run build
npm run verify:standalone
node scripts/verify-standalone.mjs --private --render
# With the dev server running:
npx playwright test tests/e2e/byok.spec.ts
```

Tests use synthetic keys and mocked model responses. They verify missing-key rejection despite an operator key, separate concurrent visitor credentials, blocked private destinations, DNS pinning, redirect rejection, remembered-key reload, optional page-only key clearing, backup exclusion, and preserved vocabulary. No personal key is needed for these tests.

Reference design guidance: [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) and [Node HTTPS](https://nodejs.org/api/https.html).

## 中文要点

网站公开访问，AI 请求每次都要携带使用者自己的 API 密钥，不回退到站长环境变量中的密钥。没有密钥仍可使用本机规则整理和练习。开启“记住此设备”会将连接设置和密钥一起保存在当前浏览器的 localStorage；关闭则仅在当前页面使用，刷新后清除。清除按钮同时移除当前与保存的密钥。请只在信任的个人设备上使用记住选项。

支持 OpenAI、Anthropic 原生 Messages 及自定义兼容接口。导入窗口只显示当前配置和设置入口，不重复要求填写；点击 AI 操作前展示发送说明，只有点击后才发送材料。密钥经本站后端转发给所选服务商，不进入词库备份，服务器不保存密钥。

协议参考：[OpenAI model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini)、[Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)、[Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create)。
