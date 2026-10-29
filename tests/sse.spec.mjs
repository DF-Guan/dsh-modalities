/**
 * Tests for the SSE stream translation layer.
 *
 * `translateSse` receives a `Response` and yields harness chunks; `sseLines`
 * splits an SSE stream into `data:` lines.
 */
import { sseLines, eventOf, translateSse } from '../src/sse.js'
import { run, assert as ok, flush } from './suite.mjs'

async function collect(generator) {
  const items = []
  for await (const item of generator) items.push(item)
  return items
}

async function makeStream(lines) {
  const readable = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(new TextEncoder().encode(line))
      }
      controller.close()
    },
  })
  return new Response(readable, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

/** Build one SSE data line from a JSON payload, so the literal stays self-consistent. */
function data(payload) { return 'data: ' + JSON.stringify(payload) + '\n\n' }

/** Build one SSE data line from a tool-call delta, so the nesting stays readable. */
function toolCallDelta(id, name, args) {
  const call = { id, function: { name, arguments: args } }
  const delta = { tool_calls: [call] }
  return data({ choices: [{ index: 0, delta }] })
}

run(async () => {
  const events = []
  for await (const line of sseLines(await makeStream([
    data({ choices: [{ index: 0, delta: { content: 'hi' } }] }),
    data({ choices: [{ index: 0, delta: { content: ' there' } }] }),
  ]))) {
    events.push(eventOf(line))
  }
  ok(events.length === 2, `2 event lines parsed, got ${events.length}`)
  ok(events[1].choices[0].delta.content === ' there', 'second line parses')
})

run(async () => {
  ok(eventOf(undefined) === null, 'undefined line is null')
  ok(eventOf('') === null, 'empty line is null')
  ok(eventOf('{') === null, 'unparseable line is null')
  ok(JSON.stringify(eventOf('{"a":1}')) === '{"a":1}', 'parseable line survives')
})

run(async () => {
  const chunks = await collect(translateSse(await makeStream([
    data({ choices: [{ index: 0, delta: { content: 'hello' } }] }),
    data({ choices: [{ index: 0, delta: { content: ' world' } }] }),
    data(null),
    data({ choices: [], finish_reason: 'stop' }),
  ])))
  const text = chunks.filter(c => c.type === 'text-delta').map(c => c.text).join('')
  ok(text === 'hello world', `collected text: ${JSON.stringify(text)}`)
  ok(chunks.length > 0, 'chunks emitted')
  ok(chunks.some(c => c.type === 'finish'), 'ends with finish chunk')
})

run(async () => {
  const chunks = await collect(translateSse(await makeStream([
    toolCallDelta('t1', 'a', ''),
    data({ choices: [{ index: 0, delta: { content: '' } }], finish_reason: 'tool_calls' }),
  ])))
  const toolCall = chunks.find(c => c.type === 'block-start' && c.blockType === 'tool-call')
  ok(toolCall !== undefined, 'tool-call block-start lands')
  const delta = chunks.find(c => c.type === 'tool-call-delta')
  ok(delta !== undefined && delta.id === 't1' && delta.name === 'a', 'tool-call-delta carries id and name')
  ok(chunks.some(c => c.type === 'finish'), 'ends with finish chunk')
})

process.exitCode = await flush()
