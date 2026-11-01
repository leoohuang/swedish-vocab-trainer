# Public website and bring-your-own-key AI

The standalone deployment defaults to `SITE_ACCESS_MODE=public-byok`.

- Anyone can open the website, import a clearly separated vocabulary list locally, and practice without a website password or AI key.
- AI extraction and topic generation require the visitor's own API key on each request. Public mode never loads or falls back to the operator's `OPENAI_API_KEY`, even if that environment variable remains configured.
- For an optional private deployment, set `SITE_ACCESS_MODE=private`, `SITE_PASSWORD`, and the server AI environment variables. Do not use private mode when you intend to offer public BYOK access.

## For learners

Open **Data & settings → Personal AI settings**, or expand **Use your own API / AI settings** inside the import window.

1. Choose OpenAI or a custom OpenAI-compatible provider.
2. Enter the API root Base URL (for example, `https://api.openai.com/v1`), model name, and request format: Responses API or Chat Completions.
3. Enter your own key and choose **Use this API on this page**. This validates settings locally; it does not test your balance or make a model request. The provider checks the key on an actual request.
4. Review the material-sending consent and start extraction or generation. Your provider bills your account.

Custom models must support JSON Schema structured output. An endpoint supporting ordinary chat alone may reject the schema; choose a compatible model. Base URLs must use a public HTTPS domain on port 443, without embedded login credentials, query strings, or fragments. Do not append `/responses` or `/chat/completions`. Localhost, private networks, and IP-literal URLs are not supported by the public proxy.

The key stays in JavaScript page memory only. Reloading or closing the page clears it. It is not stored in localStorage, sessionStorage, IndexedDB, backups, or URLs. Non-secret model and endpoint preferences are stored for convenience. **Clear key** removes the active key from the current page.

**Trust boundary:** the key and current material are sent over HTTPS to this app's backend, which forwards them to the provider you specify. The application does not persist or log keys. This is not a browser-direct or end-to-end encrypted connection to the provider; only use a website and endpoint you trust. No key is sent for status checks or local parsing.

## Implementation

- `src/ai-connection.ts`: page-memory credentials and non-secret preferences.
- `src/AiConnectionSettings.tsx`: bilingual settings in the settings page and import modal.
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

Tests use synthetic keys and mocked model responses. They verify missing-key rejection despite an operator key, separate concurrent visitor credentials, blocked private destinations, DNS pinning, redirect rejection, browser storage exclusion, key clearing on reload, and preserved vocabulary. No personal key is needed for these tests.

Reference design guidance: [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) and [Node HTTPS](https://nodejs.org/api/https.html).

## 中文要点

网站公开访问，AI 请求每次都要携带使用者自己的 API 密钥，不回退到站长环境变量中的密钥。没有密钥仍可使用本机规则整理和练习。密钥只留在当前页面内存，刷新后清除；只保存非敏感的模型、地址和接口格式偏好。

密钥会经过本站后端转发给所选服务商，因此用户应信任网站和接口提供方。应用不落盘、不主动记录密钥，不把密钥放进 URL 或词库备份。自定义地址需要公开 HTTPS 域名和 443 端口；禁止本机、内网、IP 地址和跳转。
