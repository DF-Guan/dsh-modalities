/**
 * Map a gateway's `input_modalities` declaration to this build's vocabulary.
 *
 * Gateways spell the same field four ways, so this module reads every one of
 * them and drops values outside the vocabulary that an adapter can send:
 *
 * | spelling | shape |
 * | --- | --- |
 * | flat strings | `"input_modalities": ["text", "image"]` |
 * | nested | `"architecture": { "input_modalities": ["text", "image", "file"] }` |
 * | camel | `"inputModalities": ["text"]` |
 * | object array | `"input_modalities": [{ "type": "text" }, { "type": "image" }]` |
 *
 * The last one is what `https://discovery-api.intern-ai.org.cn/v1/models`
 * answers: filtering that array for the strings `text`/`image` finds nothing,
 * so every model behind that endpoint was adopted as text-only.
 */

/** Modality this build can send: pi-ai's vocabulary. */
const LISTED_MODALITIES = ['text', 'image']

/**
 * One candidate modality list as this build's vocabulary, in the order the
 * endpoint declares it, or `undefined` when it names nothing this build sends.
 * Values outside the vocabulary are dropped rather than reported: a modality
 * the adapter cannot carry would be adopted as a capability it does not have.
 * @param {unknown} value - `input_modalities`, `inputModalities`, or the OpenRouter `architecture.input_modalities`
 * @returns {('text'|'image')[]|undefined} modality list in endpoint order, or `undefined`.
 */
function listedModalities(value) {
  if (!Array.isArray(value)) return undefined
  /** @type {string[]} */
  const named = []
  for (const row of value) {
    const modality = typeof row === 'string' ? row : (row ?? {})?.type
    if (typeof modality === 'string') named.push(modality)
  }
  const known = LISTED_MODALITIES.filter(modality => named.includes(modality))
  if (known.length === 0) return undefined
  return known.toSorted((left, right) => named.indexOf(left) - named.indexOf(right))
}

/** The first candidate that declares a modality this build sends. */
export function modalities(...candidates) {
  for (const candidate of candidates) {
    const known = listedModalities(candidate)
    if (known !== undefined) return known
  }
  return undefined
}

/** Read the declared modalities of one listing entry. */
export function modalitiesOf(entry) {
  return modalities(
    entry?.input_modalities,
    entry?.inputModalities,
    entry?.architecture?.input_modalities,
  )
}

/**
 * Read the window capacity and output cap of a gateway listing entry, by the
 * spelling the endpoint uses.
 */
function capacityOf(raw) {
  /** @type {number|undefined} */
  const windowField = raw?.context_window ?? raw?.contextWindow ?? raw?.max_context_length
  /** @type {number|undefined} */
  const capField = raw?.max_output_tokens ?? raw?.maxTokens ?? raw?.max_tokens ?? raw?.limit?.output ?? raw?.top_provider?.max_completion_tokens
  return { contextWindow: typeof windowField === 'number' ? windowField : undefined, maxTokens: typeof capField === 'number' ? capField : undefined }
}

/**
 * Convert a whole gateway listing reply into one adapter's `LlmDiscoveredModel[]`.
 * @param {unknown} body - the parsed `GET /models` reply, either `data` or `models`.
 * @returns {LlmDiscoveredModel[]}
 */
export function recordModels(body) {
  const data = (Array.isArray(body?.data) ? body.data : [])
  const models = body?.models
  const rows = Object.values(models ?? {}).filter(raw => raw !== null && typeof raw === 'object')
  const list = [...data.map(raw => ({ raw })), ...rows.map((raw, i) => ({ key: `model-${i}`, raw }))]
  /** @type {LlmDiscoveredModel[]} */
  const mapped = []
  for (const { raw } of list) {
    const id = raw?.id
    if (typeof id !== 'string' || id.length === 0) continue
    const { contextWindow, maxTokens } = capacityOf(raw)
    mapped.push({
      id,
      name: raw?.name ?? id,
      contextWindow,
      maxTokens,
      inputModalities: modalitiesOf(raw),
    })
  }
  return mapped
}
