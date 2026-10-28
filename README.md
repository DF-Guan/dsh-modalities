# dsh-modalities

A DeepSeek Harness plugin that maps a gateway's `input_modalities` declaration into the harness vocabulary so mission-capable models behind a gateway can accept image attachments again.

<div align="center">

<em>👉 Pick your language: <strong><a href="./README.md">English</a></strong> | <a href="./README.zh-CN.md">中文</a></em>

</div>

<h1 align="center">
  <img src="art/logo.svg" alt="dsh-modalities logo" width="96" height="96">
</h1>

<h3 align="center">
  Map <code>input_modalities</code> → <code>input</code> capability
</h3>

<p align="center">
  <a href="#what-it-does">What it does</a> •
  <a href="#the-gap">The gap</a> •
  <a href="#installing">Installing</a> •
  <a href="#tests">Tests</a> •
  <a href="https://github.com/DF-Guan/dsh-modalities"><strong>Source</strong></a>
</p>

<p align="center">
  <a href="https://github.com/DF-Guan/dsh-modalities"><img src="https://img.shields.io/badge/dsh-plugin-9a7919?style=for-the-badge&label=plugin&logo=github" alt="DSH plugin badge"></a>
  <a href="https://github.com/DF-Guan/dsh-modalities/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge" alt="MIT license"></a>
</p>

---

## What it does

The DSH core CLI reads model `input` from three rungs:

```
entry input → installed catalog entry → route defaultInput (which defaults to [text])
```

Most listings don't declare `input_modalities` at all. But an endpoint that answers

```
GET {baseURL}/v1/models
```

**does** — and it answers them opaquely:

```json
"input_modalities": [
  { "type": "text", "supported_inputs": { "max_context_length": { "value": 524288, "unit": "token" } } },
  { "type": "image", "supported_inputs": { "sources": { "type": "enum", "values": ["url", "base64"] } } }
]
```

Because the core only accepts flat string spellings (`["text", "image"]`), every model is adopted as **text-only** and `read_image` refuses the image with:

```
model "Sage-A1.5" does not declare image input
```

## The gap

| The endpoint says | The core sees | The result |
|---|---|---|
| `input_modalities` object array | `input` not declared | Image attachments rejected (treated as text-only) |

This happens on routes whose listings declare modalities as objects, the native format of the intern discovery endpoint.

## What it converts

| spelling | shape |
|---|---|
| flat strings | `"input_modalities": ["text", "image"]` |
| nested | `"architecture": { "input_modalities": ["text", "image", "file"] }` |
| camel | `"inputModalities": ["text"]` |
| object array | `"input_modalities": [{ "type": "text" }, { "type": "image" }]` |

`file` / `audio` / `video` entries are dropped: the adapter never accepts a modality it can't send. An entry that names none keeps the field absent, so a listing that says nothing is still read as unknown rather than defaulting to text-only.

## Why it matters

- Image attachments work on gateways listing modalities as objects
- No hand-authoring of `input` fields per route or entry
- Models resolve from the endpoint listing, preserving its order
- Out-of-vocabulary modalities are dropped, never claimed as capabilities

## Installing

Add the bundle to your profile:

```sh
dsh plugin --profile <name> add github:DF-Guan/dsh-modalities
```

A git install fetches the source, so the `build` step is skipped by this package's `main` pointing at `src/` directly.

## Configure

The row injects into the profile with these fields:

```yaml
- id: dsh-modalities
  name: dsh-modalities
  config:
    endpoint: 'https://api.example.com/v1'
    apiKey: !!js process.env.MODALITY_API_KEY
    providers: [intern-modalities]
```

The adapter registers itself under the `intern-modalities` route, caches the listing for ten minutes, and resolves `listModels` and `resolveModel` from the listing.

## Tests

```sh
node tests/modality.spec.mjs
```

20 assertions across all spellings, including the object-array spelling this plugin exists to fix. The adapter is still voicing an adapter-in-progress step, so this test covers the modality path only.

## Notes

- The fix belongs in the core: `packages/llm/llm-pi-ai/src/discovery.ts`, which should read `input_modalities` regardless of spelling.
- This plugin demonstrates an out-of-core path for users who don't run the core patch.
- An exact equivalent fix is on a fork branch of deepseek-harness [see core patch](#progress).
- License: MIT.

## Progress

The core development is tracked separately:

| Item | State |
|---|---|
| Plug-in installed here | `main` branch |
| Core patch (`discovery.ts`) | Ready on a fork branch, forwards to #8876 |

---

<h2 align="center">🇨🇳 中文说明</h2>

<p align="center">
  这个插件将端砚网关返回的 <code>input_modalities</code> 对象数组（<code>[{type: "image"}]</code>），映射为 DSH 能识别的 <code>input</code> 能力表。
</p>

<p align="center">
  原理：DSH 核心 CLI 不识别对象拼接法，所有模型被当作纯文本模型接进系统，图片附件被拒绝。安装后模型可以直接接受图片，无需手动写 <code>input: [text, image]</code>。
</p>

<p align="center">
  完整版说明请查看：<strong><a href="./README.zh-CN.md">中文 README</a></strong>
</p>
