# ord. — Your words. Your pace.

[简体中文](README.zh-CN.md) · [Website](https://ord-swedish-practice.onrender.com/) · [Demo video](docs/media/ord-demo.mp4)

A Swedish vocabulary practice app built around the notes you already have.

Import a messy word list, paste a reading passage, or ask AI for vocabulary on a topic. Review the results, save a separate deck, and practice in groups of up to ten words—from recognizing meanings to recalling spellings.

**Status: early personal project, actively being tested and improved.** The hosted website is password-protected. This is not an official SFI resource or a publicly open service.

![ord. English interface](docs/media/home-en.png)

## Why I built it

Learning Swedish left me with vocabulary scattered across notes and reading material. I wanted to turn that material into practice without first reformatting every entry by hand.

The result is a small, local-first learning app. Import results remain editable, AI-added content is identified, and practice progress stays in the learner's browser.

## What it does

- **Bring your own material:** TXT, Markdown, CSV, XLSX, DOCX, text-based PDF, or pasted text. Use local parsing for separated lists, or opt in to AI-assisted extraction for messy notes and passages.
- **Generate by topic:** choose a topic, SFI course A–D, and 5–30 words. Review AI-generated meanings, forms, and examples before saving.
- **Keep sources reviewable:** inspect source text, distinguish AI-added meanings and examples, edit uncertain entries, and keep unchecked entries pending.
- **Practice adaptively:** words with no independent correct spelling return more often. One correct spelling reduces frequency. Two independent correct spellings remove the word from the round. The round finishes only when every word passes; hints do not count.
- **Review:** a home-page review area offers due reviews and on-demand reinforcement, scoped to the selected deck. Review intervals use simple, inspectable rules.
- **Stay organized:** named decks, stable ten-word groups, favorites, search, and a selected deck that stays selected across practice, navigation, and reloads.
- **Hear feedback:** device-provided Swedish pronunciation, locally synthesized typing and answer sounds, and answer animations.
- **Choose the interface:** Chinese or English, with the preference saved in the browser. Language changes preserve vocabulary, original meanings, and practice progress.
- **Keep a backup:** JSON export/restore and non-destructive backup merge, plus vocabulary CSV export. Imports create separate decks; stale-tab writes are rejected to prevent overwrites.

![Spelling practice](docs/media/practice-en.png)

## Watch the demo

[Watch / download the short MP4 demo](docs/media/ord-demo.mp4).

The recording uses a fresh browser profile and a **synthetic three-word deck**. It shows real local parsing and practice interactions; it makes no AI requests and contains no personal study material. The source is in [the reproducible demo test](tests/e2e/record-demo.spec.ts).

## Run locally

Requires Node.js **24+**, npm, and Chrome for the browser tests.

```sh
npm ci
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173/`. Local parsing works without an API key. To enable AI, configure the server environment as described in [AI setup (Chinese)](docs/AI整理接入.md). Keep keys on the server; never put them in frontend code.

```sh
npm test             # Unit and data-integrity tests
npm run build        # Type checking + frontend + standalone Node build
npm run test:e2e     # Browser tests; start the dev server first
npm start            # Standalone Node server
```

The independent website supports Node.js and Docker deployment. See [deployment instructions (Chinese)](docs/独立网站部署.md). Render deploys the hosted instance from this repository.

## Data and privacy

Decks, pending imports, active practice, and history are stored in **IndexedDB in the current browser, for the current website origin**. Interface language and selected-deck preferences use local browser storage.

- There are no user accounts or cross-device sync. Another browser, device, or URL has separate data.
- Files are read locally. AI requests send the current material text or topic only after consent. Skipping known words in passage extraction is a separate option that sends practiced terms.
- Use a JSON backup and **Merge a backup** to move decks between the local and hosted sites. Export CSV when you only need the vocabulary.
- The website access password protects the hosted AI endpoint. It is not a cloud account or a vocabulary-sync service.

## Current limits

- AI output needs review. SFI courses guide difficulty; generated lists are not official SFI word lists.
- Changing interface language does not translate user content. The import workflow was developed primarily around Swedish–Chinese notes; clearly separated English meanings can also be imported.
- No OCR, images, handwriting, or legacy `.doc` files. File limit: 10 MB; PDF limit: 80 pages. AI text limit: 30,000 characters per request.
- Review scheduling is a fixed-rule implementation, not FSRS or a validated learning-outcome model. Passing a round does not prove long-term retention.
- Swedish speech depends on voices installed on the device and browser audio permissions. No cloud speech fallback is used.
- Automated UI checks use Chrome, including mobile-size viewports. Other browsers and physical phones need further testing.
- Google Fonts is requested for the interface. Whether device-provided speech uses a network depends on the platform.
- Older practice-only records without per-word spelling evidence are marked for verification, rather than silently treated as mastered.

## Project map

| Path                                      | Purpose                                                         |
| ----------------------------------------- | --------------------------------------------------------------- |
| `src/App.tsx`                             | Import review, decks, practice, and settings                    |
| `src/model.ts`                            | Answer checking, adaptive practice, and review intervals        |
| `src/groups.ts`                           | Stable groups and group recommendations                         |
| `src/i18n.ts`, `src/translations.en.json` | Interface language and English messages                         |
| `src/parser.ts`                           | Local file reading and vocabulary parsing                       |
| `src/storage.ts`, `src/backup.ts`         | Validated browser persistence, conflict checks, backup merge    |
| `src/audio.ts`                            | Swedish speech and synthesized effects                          |
| `server/`, `shared/`                      | Server-side AI requests, validation, and website access control |
| `tests/`                                  | Unit tests, browser flows, and synthetic file fixtures          |

Source is available at [leoohuang/swedish-vocab-trainer](https://github.com/leoohuang/swedish-vocab-trainer). No reuse license has been selected.
