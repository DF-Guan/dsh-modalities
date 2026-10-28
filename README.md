# dsh-modalities

A DeepSeek Harness plugin that maps a gateway's `input_modalities` declaration into the harness vocabulary.

It fixes the gate that refuses every image attachment a mission-capable model on a custom provider:
the route's `input` declaration.

![Plugin logo](art/logo.svg)

## The gap

The core CLI reads model `input` from three rungs:

```
entry input → installed catalog entry → route defaultInput, which defaults to [text]
```

Most listings don't declare `input_modalities` at all. But a gateway that answers
`GET {baseURL}/v1/models` *does* — and it answers them opaquely:

```json
"input_modalities": [
  { "type": "text", "supported_inputs": { "max_context_length": { "value": 524288, "unit": "token" } } },
  { "type": "image", "supported_inputs": { "sources": { "type": "enum", "values": ["url", "base64"] } } }
]
```

Canceling that array for the strings `text`/`image` finds nothing. So every model
behind the gateway was adopted as text-only, and `read_image` refused the image with:

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

`file` / `audio` / `video` entries are dropped: the adapter never accepts a modality
it can't send. An entry that names none keeps the field absent, so a listing that says
nothing is still read as unknown, rather than as text-only.

## Why it matters

- Image attachments work on gateways that list modalities as objects (their native shape)
- No hand-authoring of `input` fields per route or per entry
- The adapter resolves models from the endpoint listing, keeping its own order
- Out-of-vocabulary modalities are dropped, never claimed as capabilities

## Installing

Add the bundle to your profile:

```sh
dsh plugin --profile <name> add github:DF-Guan/dsh-modalities
```

A git install fetches the source, so the `build` step is skipped by this package's
`main` pointing at `src/` directly.

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

The adapter registers itself under the `intern-modalities` route, caches the listing
for ten minutes, and resolves `listModels` and `resolveModel` from the listing.

## Tests

```sh
node tests/modality.spec.mjs
```

20 assertions cover all spellings, including the object-array spelling this plugin
exists to fix. The adapter is still voicing an adapter-in-progress step, so this test
covers the modality path only.

## Contribution

The gap belongs in the core: `packages/llm/llm-pi-ai/src/discovery.ts` should read
`input_modalities` regardless of spelling.

The build's equivalent fix lives in this plugin. If a user has the listing available
at launch and does not run this plugin, they can achieve the same result by declaring
`input: [text, image]` per entry — the plugin stops needing that line at the route.

## Public artifact

This plugin is a contribution to the DSH ecosystem, not a core change.
