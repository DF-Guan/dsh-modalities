/**
 * Parse an SSE stream into data lines, translated into harness chunks.
 *
 * A generator keeps memory bounded: callers must drain it before the
 * response is discarded. The SSE line offset for `data:` lines matches
 * `eventsource-parser`'s crate: `data: foo` → `foo`, `data:foo` → `foo`.
 */

/** One SSE data line emitted by the generator. */
export async function* sseLines(response) {
  const reader = response.body.getReader()
  /** @type {string} */
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      if (buffer.trim().length > 0) yield buffer
      break
    }
    buffer += new TextDecoder().decode(value)
    let end
    while ((end = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, end)
      if (line.startsWith('data: ')) yield line.slice(6)
      else if (line.startsWith('data:')) yield line.slice(5)
      buffer = buffer.slice(end + 1)
    }
  }
}

/** Parse one SSE data line, or `null` when it is not parseable JSON. */
export function eventOf(line) {
  if (line === undefined || line.trim() === '') return null
  try {
    return JSON.parse(line)
  } catch (_error) {
    return null
  }
}

/** Translate an OpenAI-compatible SSE stream into harness chunks. */
export async function* translateSse(response, signal) {
  let index = 0
  /** @type {string} */
  let collectedText = ''
  /** @type {Array<unknown>} */
  const toolCalls = []
  /** Whether a text block is open for the current `index`. */
  let textOpen = false
  for await (const line of sseLines(response)) {
    if (signal !== null && signal !== undefined && signal.aborted) throw new Error('aborted')
    const payload = eventOf(line)
    if (payload === null || payload.choices === undefined || payload.choices.length === 0) continue
    const choice = payload.choices[0]
    const delta = choice.delta ?? {}
    const content = delta.content

    if (content !== undefined && content !== null) {
      if (!textOpen) {
        yield { type: 'block-start', index, blockType: 'text' }
        textOpen = true
      }
      yield { type: 'text-delta', index, text: String(content) }
      collectedText += content
    }
    if (delta.tool_calls !== undefined && delta.tool_calls !== null) {
      for (const t of delta.tool_calls) {
        const id = t.id ?? brand()
        yield { type: 'block-start', index, blockType: 'tool-call' }
        yield { type: 'tool-call-delta', index: index, id, name: t.function?.name ?? '', argumentsDelta: t.function?.arguments ?? '' }
        yield { type: 'block-end', index, block: { type: 'tool-call', id, name: t.function?.name ?? '', arguments: t.function?.arguments ?? '' } }
      }
    }
    const usage = payload.usage
    if (usage !== undefined) yield { type: 'usage', usage }
    const finish = payload.finish_reason
    if (finish !== undefined) {
      if (textOpen) yield { type: 'block-end', index, block: { type: 'text', text: collectedText } }
      yield { type: 'finish', reason: { kind: finish } }
      return
    }
  }
  if (textOpen) yield { type: 'block-end', index, block: { type: 'text', text: collectedText } }
  yield { type: 'finish', reason: { kind: 'stop' } }
}

/** Stable random id for SSE chunks that come without one. */
function brand() {
  return 'dsh-' + Math.random().toString(36).slice(2)
}
