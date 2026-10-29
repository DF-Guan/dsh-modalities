# dsh-modalities

## What it does

A plugin that maps a gateway's `input_modalities` declaration into DeepSeek Harness' vocabulary, so mission-capable models behind a gateway can accept image attachments again.

## The gap

The DSH core reads model `input` from three rungs: `entry input -> installed catalog entry -> route defaultInput, which defaults to [text]`.

Most listings don't declare `input_modalities` at all. But an endpoint like the intern discovery, answered `GET /v1/models`, does — and it answers them **opaquely**:

```json
"input_modalities": [
  { "type": "text", "supported_inputs": { "max_context_length": { "value": 524288, "unit": "token" } } },
  { "type": "image", "supported_inputs": { "sources": { "type": "enum", "values": ["url", "base64"] } } }
]
```

The core only accepts flat strings (`["text", "image"]`), so every model was adopted as text-only and `read_image` refused images with:

```
model "Sage-A1.5" does not declare image input
```

## What it converts

| spelling | shape |
| --- | --- |
| flat strings | `"input_modalities": ["text", "image"]` |
| nested | `"architecture": { "input_modalities": ["text", "image", "file"] }` |
| camel | `"inputModalities": ["text"]` |
| object array | `"input_modalities": [{ "type": "text" }, { "type": "image" }]` |

`file` / `audio` / `video` entries are dropped. The adapter never accepts a modality it can't send.

## Installing

```sh
dsh plugin --profile <name> add github:DF-Guan/dsh-modalities
```

## Tests

`node tests/modality.spec.mjs` — 20 assertions across all spellings, including the object-array spelling this plugin exists to fix.

## Notes

The gap belongs in the core: `packages/llm/llm-pi-ai/src/discovery.ts`. This plugin demonstrates an out-of-core path for users who do not run the core patch. An exact equivalent fix is already on a fork branch of deepseek-harness (see the deepseek-harness discussion #8876).

---

## 这是做什么的（中文说明）

将端砚（intern）网关返回的 `input_modalities` 对象数组声明，映射为 DSH 能识别的 `input` 能力表。原理：核心 CLI 不识别对象拼接法，所以所有模型被当作纯文本模型接进系统。

安装后，网关返回 `[{type: "image"}]` 的模型可以直接接受图片附件，无需手动写 `input: [text, image]`。

持久许可证为 MIT，仓库 `https://github.com/DF-Guan/dsh-modalities`。
