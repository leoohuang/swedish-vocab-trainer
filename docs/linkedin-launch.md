# LinkedIn sharing package

## English post — ready to review

While learning Swedish, I kept collecting vocabulary in scattered notes—so I built a tool to turn those notes into practice.

It’s called **ord.**, Swedish for “word”. You can import a word list or a reading passage, review what AI extracts, and practice in small groups. You can also generate a vocabulary list from a topic and an SFI course level.

Using it myself has shaped the details. New imports now create separate decks. A word stays in the round until I spell it correctly twice without hints. Words I struggle with return more often, and the deck I choose stays selected. There’s also a review area and a Chinese/English interface switch. The website is open to visitors, with a bring-your-own-key option for OpenAI and compatible APIs.

I built this with AI-assisted development, then tested and revised the flows against problems I encountered as a learner. It has been a useful exercise in turning a personal frustration into a working product—and in finding the gaps between a feature that runs and one that feels right to use.

It’s still an early personal project. Progress is saved in the current browser, and AI suggestions need checking.

I’d love feedback from Swedish learners and people building language-learning tools: how do you turn your own notes into practice?

Code and project notes: https://github.com/leoohuang/swedish-vocab-trainer

#Swedish #LanguageLearning #PersonalProject #AI

## What to attach

- Upload `docs/media/ord-demo.mp4` as the main video. The recording uses synthetic vocabulary, local parsing, and a fresh browser profile; it contains no personal study data or API requests.
- A still image is available at `docs/media/home-en.png`; the spelling view is `docs/media/practice-en.png`.
- The demo is silent. Suggested video caption: “ord. — From your notes to Swedish practice. Early personal project.”

## Links and access

Website: https://ord-swedish-practice.onrender.com/

The site is publicly accessible. Local parsing and practice need no API key; AI generation and extraction require the visitor’s own OpenAI or compatible API key. The key passes through the app backend to the selected provider and clears on reload. Do not include an API key in the post.

Repository: https://github.com/leoohuang/swedish-vocab-trainer

The repository is currently **public**, verified through GitHub. The post includes the source link. No reuse license has been selected; decide on one if you want to grant reuse rights. This preparation did not change repository visibility or access.

## 中文说明

这份帖子的定位是“从真实学习需求出发、用 AI 辅助开发并持续迭代的个人项目”。没有声称已经验证学习效果，也没有把当前版本写成成熟产品。

仓库当前公开，主帖已附 GitHub 源码链接。视频展示实际本机整理和练习流程。网站现已公开，可直接分享网址；AI 功能由试用者使用自己的 API 密钥，本机规则整理和练习不需要密钥。发布前核对一次文字和视频即可。

## Suggested alt text for the still image

English interface of ord., a Swedish vocabulary practice app. The home page offers note import, topic-based vocabulary generation, and a review section with due review and reinforcement.

## Rebuild the demo locally

With the dev server running and `ffmpeg` available:

```sh
npx playwright install ffmpeg
ORD_RECORD_DEMO=1 npx playwright test tests/e2e/record-demo.spec.ts
ffmpeg -y -i test-results/ord-demo-source.webm -an -c:v libx264 -crf 22 -pix_fmt yuv420p -movflags +faststart docs/media/ord-demo.mp4
```

The packaged video is approximately 43 seconds, 1280 × 800, with no audio.
