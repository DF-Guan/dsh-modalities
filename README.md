# dsh-modalities

Your model says it can read pictures. DSH says it can't. This plugin fixes the mismatch.

<div align="center">

👉 Pick your language: **[English](./README.md)** · [中文](./README.zh-CN.md)

</div>

<h1 align="center">
  <img src="art/logo.svg" alt="dsh-modalities logo" width="96" height="96">
</h1>

<h3 align="center">Let models that accept images actually receive them</h3>

<p align="center">
  <a href="#the-problem">The problem</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#install">Install</a> ·
  <a href="#configure">Configure</a> ·
  <a href="#test">Test</a> ·
  <a href="https://github.com/DF-Guan/dsh-modalities"><strong>Source</strong></a>
</p>

<p align="center">
  <a href="https://github.com/DF-Guan/dsh-modalities"><img src="https://img.shields.io/badge/dsh-plugin-9a7919?style=for-the-badge&label=plugin&logo=github" alt="DSH plugin"></a>
  <a href="https://github.com/DF-Guan/dsh-modalities/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge" alt="MIT"></a>
</p>

---

## The problem

On the 书生·端砚 (intern) model page, models like **Sage-A1.5**, **Intern-S2** and **Qwen3.8-27B** are listed as `Text, Image` — they accept pictures:

![书生·端砚 model list — note the "Text, Image" column](art/model-list-screenshot.png)

But when DSH discovers those same models through the gateway API, it reads their capabilities in a format it doesn't understand. The gateway reports:

```json
{
  "id": "Sage-A1.5",
  "input_modalities": [
    { "type": "text" },
    { "type": "image" }
  ]
}
```

DSH expects a simple list of words — `["text", "image"]`. It doesn't know how to read the `{ "type": "image" }` form, so it concludes the model has **no declared input capability at all** and falls back to text-only.

The result:

```
model "Sage-A1.5" does not declare image input
```

Your image attachment gets rejected — even though the model page clearly says it handles images.

## How it works

This plugin sits between the gateway and DSH. It reads the capability list in every format a gateway might use, and translates it into the simple list of words DSH understands:

| What the gateway sends | What DSH receives |
|---|---|
| `["text", "image"]` (plain words) | `["text", "image"]` |
| `[{ "type": "text" }, { "type": "image" }]` (objects — the 书生·端砚 format) | `["text", "image"]` |
| `{"architecture": {"input_modalities": ["text", "image", "file"]}}` (nested) | `["text", "image"]` |
| `{"inputModalities": ["text"]}` (camelCase) | `["text"]` |

Two rules it follows:

- **It never invents capabilities.** If a gateway says a model handles `file`, `audio` or `video`, those are dropped — DSH can't send them anyway, and claiming them would be a lie.
- **It never defaults to text.** A model that declares nothing stays "unknown" rather than silently becoming text-only. You get an honest "I don't know" instead of a wrong answer.

## Install

```sh
dsh plugin --profile <name> add github:DF-Guan/dsh-modalities
```

That's it — no build step, no compiled files. The plugin is plain JavaScript and runs directly from source.

## Configure

After installing, add one row to your profile patch (`cordis.patch.yml`):

```yaml
- id: modality-gateway
  name: dsh-modalities
  config:
    endpoint: 'https://api.example.com/v1'
    apiKey: !!js process.env.MODALITY_API_KEY
    providers: [intern-modalities]
```

| Field | What it is |
|---|---|
| `endpoint` | The gateway base URL — the one that answers `GET {endpoint}/v1/models` |
| `apiKey` | Your API key for that gateway. Set the `MODALITY_API_KEY` environment variable and don't commit the real value |
| `providers` | The route names this adapter owns. `intern-modalities` is the 书生·端砚 route |

The adapter fetches the model list once, keeps it for ten minutes, and reuses it for every request — so there's one network call per ten minutes, not one per generation.

## Test

```sh
npm test
```

**47 assertions** across three files, all passing:

| File | What it tests | Assertions |
|---|---|---|
| `tests/modality.spec.mjs` | All four spelling formats, plus capacity fields and empty inputs | 20 |
| `tests/provider.spec.mjs` | Listing resolution, cache hits/misses, unknown-model errors, streaming | 15 |
| `tests/sse.spec.mjs` | SSE line parsing, text streaming, tool-call chunks | 12 |

The fixture at `tests/fixtures/gateway.json` is a real-shaped 书生·端砚 reply, so the tests prove the actual bug is fixed — not just a made-up example.

## What this is, and isn't

**This fixes the symptom.** The real fix belongs in DSH core (`packages/llm/llm-pi-ai/src/discovery.ts`), which should read `input_modalities` no matter how it's spelled. An equivalent core patch is ready on a fork branch and discussed in [deepseek-harness Discussion #8876](https://github.com/deepseek-ai/deepseek-harness/discussions/8876).

**This plugin is for you if** you want image attachments working today and can't wait for the core patch to land. It's a working adapter, not a proof-of-concept — it has tests, a cache, error handling and streaming support.

## Progress

| Item | State |
|---|---|
| Plugin | `main` branch, 47 tests passing |
| Core patch (`discovery.ts`) | Ready on fork branch, discussed at #8876 |
| Community post | [Discussion #11364](https://github.com/deepseek-ai/deepseek-harness/discussions/11364) |

---

<h2 align="center">🇨🇳 中文说明</h2>

<p align="center">
  你的模型明明写着能看图，DSH 却拒绝接收图片。这个插件修补两者之间的信息差。
</p>

<p align="center">
  <strong><a href="./README.zh-CN.md">查看完整中文说明 →</a></strong>
</p>
