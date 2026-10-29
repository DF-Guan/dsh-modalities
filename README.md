# dsh-modalities

Your model says it can read pictures. DSH discovers it without that information. This plugin fills the gap.

<div align="center">

👉 Pick your language: **[English](./README.md)** · [中文](./README.zh-CN.md)

</div>

<h1 align="center">
  <img src="art/logo.svg" alt="dsh-modalities logo" width="96" height="96">
</h1>

<h3 align="center">Let models that accept images actually receive them</h3>

<p align="center">
  <a href="#what-you-see">What you see</a> ·
  <a href="#the-gap">The gap</a> ·
  <a href="#what-it-does">What it does</a> ·
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

## What you see

On the 书生·端砚 (intern) model page, models like **Sage-A1.5**, **Intern-S2** and **Qwen3.8-27B** are listed as `Text, Image` — they accept pictures:

![书生·端砚 model list — the "Input Type" column says Text, Image](art/model-list-screenshot.png)

That screenshot is the page you'd see. The table is evidence, not decoration: those three rows, and every other `Multimodal` row, declare that they take images.

## The gap

When DSH discovers those same models through the gateway API, the reply it gets looks like this. This is a real recorded response from the 书生·端砚 discovery endpoint — the file lives in my workspace at `_pr/deepseek-harness/fixtures/model-listings/intern-2026-10-28.json` (287 lines, 3 models). It is a trimmed excerpt of a larger reply that named 13 models; I kept three rows so the fixture stays small, and `Sage-A1.5` is one of them:

```json
{
  "id": "Sage-A1.5",
  "input_modalities": [
    { "type": "text", "supported_inputs": { "max_context_length": { "value": 524288, "unit": "token" } } },
    { "type": "image", "supported_inputs": { "sources": { "type": "enum", "values": ["url", "base64"] } } }
  ]
}
```

The field exists and it names `image`. The question is only whether the DSH version you run knows how to read that shape.

**This is the part I cannot verify from inside this session, and I'm saying it plainly rather than guessing:** DSH's installed copy is packaged inside `app.asar`, and I have no way to read it. So I cannot tell you whether your DSH already handles this or not. What I *can* point at is the source:

- `packages/llm/llm-pi-ai/src/discovery.ts` — the function `readListing()` decides what a gateway reply turns into. If that function reads `input_modalities` in the object-array shape, your DSH handles it. If it doesn't, the field is dropped and the model arrives with no declared input capability.
- An equivalent fix for that function exists on a fork branch and is discussed in [deepseek-harness Discussion #8876](https://github.com/deepseek-ai/deepseek-harness/discussions/8876).

This plugin is the alternative for the case where that fix isn't in the version you run.

## What it does

The plugin sits between the gateway and DSH. It reads the capability list in every format a gateway might use, and translates it into the simple list of words DSH understands:

| What the gateway sends | What DSH receives |
|---|---|
| `["text", "image"]` (plain words) | `["text", "image"]` |
| `[{ "type": "text" }, { "type": "image" }]` (objects — the 书生·端砚 format) | `["text", "image"]` |
| `{"architecture": {"input_modalities": ["text", "image", "file"]}}` (nested) | `["text", "image"]` |
| `{"inputModalities": ["text"]}` (camelCase) | `["text"]` |

Two rules it follows:

- **It never invents capabilities.** If a gateway says a model handles `file`, `audio` or `video`, those are dropped — DSH can't send them anyway, and claiming them would be a lie.
- **It never defaults to text.** A model that declares nothing stays "unknown" rather than silently becoming text-only. You get an honest "I don't know" instead of a wrong answer.

This is the same logic the core fix uses — same four spellings, same vocabulary, same "drop what you can't carry" rule. The difference is only *where* it runs: inside the adapter instead of inside `discovery.ts`.

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
    apiKey: '${MODALITY_API_KEY}'
    providers: [intern-modalities]
```

| Field | What it is |
|---|---|
| `endpoint` | The gateway base URL — the one that answers `GET {endpoint}/v1/models` |
| `apiKey` | Your API key for that gateway. Set the `MODALITY_API_KEY` environment variable and reference it from there; don't commit the real value |
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

The fixture at `tests/fixtures/gateway.json` is shaped like the real 书生·端砚 reply, so the tests prove the object-array case works — the case this plugin exists to cover.

## What this is, and isn't

**This is a workaround, not the fix.** The proper place for this logic is `packages/llm/llm-pi-ai/src/discovery.ts` inside DSH, where every gateway route benefits without installing anything. An equivalent patch is ready on a fork branch, discussed at [Discussion #8876](https://github.com/deepseek-ai/deepseek-harness/discussions/8876). If that lands in your DSH version, this plugin becomes unnecessary — and you should remove it rather than run both.

**This plugin is for you if** you want image attachments working today and your DSH version doesn't yet read the object-array shape. It's a working adapter, not a proof-of-concept — it has tests, a cache, error handling and streaming support.

## Progress

| Item | State |
|---|---|
| Plugin | `main` branch, 47 tests passing |
| Core patch (`discovery.ts`) | Ready on fork branch, discussed at #8876 |
| Community post | [Discussion #11364](https://github.com/deepseek-ai/deepseek-harness/discussions/11364) |

---

<h2 align="center">🇨🇳 中文说明</h2>

<p align="center">
  你的模型明明写着能看图，DSH 发现它时却没拿到这个信息。这个插件补上这段缺口。
</p>

<p align="center">
  <strong><a href="./README.zh-CN.md">查看完整中文说明 →</a></strong>
</p>
