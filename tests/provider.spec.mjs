/**
 * Tests for the adapter's listing path: listModels and resolveModel must land
 * with inputModalities, and the cache must not refetch on every generation.
 */
import { readFileSync } from 'node:fs'

import { ModalitiesAdapter } from '../src/provider.js'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { run, assert as ok, flush } from './suite.mjs'

const listing = JSON.parse(readFileSync(new URL('fixtures/gateway.json', import.meta.url), 'utf8'))

let fetchStub = globalThis.fetch
let calls = 0

/** Make `fetch` return the same listing body every time. */
function stubFetch() {
  return async () => {
    calls += 1
    return new Response(JSON.stringify(listing), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

run(async () => {
  const adapter = new ModalitiesAdapter({
    endpoint: 'https://acme.test/v1',
    apiKey: 'sk-test',
  })
  const original = globalThis.fetch
  calls = 0
  globalThis.fetch = stubFetch()
  try {
    const models = await adapter.listModels('intern-modalities')
    const sag = models.find(m => m.id === 'Sage-A1.5')
    ok(sag !== undefined, 'Sage-A1.5 is listed')
    ok(JSON.stringify(sag.inputModalities) === '["text","image"]', 'object spelling lands and stays')
    ok(sag.contextWindow === undefined, 'no capacity field on the listing row')
    ok(sag.maxTokens === undefined, 'no output cap on the listing row')

    const cap = models.find(m => m.id === 'gateway-cap')
    ok(cap !== undefined, 'capacity row is listed')
    ok(cap.contextWindow === 1048576, 'context window is carried over')
    ok(cap.maxTokens === 8192, 'output cap is carried over')
  } finally {
    globalThis.fetch = original
  }
})

run(async () => {
  const adapter = new ModalitiesAdapter({
    endpoint: 'https://acme.test/v1',
    apiKey: 'sk-test',
  })
  const original = globalThis.fetch
  calls = 0
  globalThis.fetch = stubFetch()
  try {
    const sag = await adapter.resolveModel('intern-modalities', 'Sage-A1.5')
    ok(JSON.stringify(sag.inputModalities) === '["text","image"]', 'resolveModel lands with modalities')
    ok(calls === 1, 'one fetch for the listing')
    const second = await adapter.resolveModel('intern-modalities', 'Sage-A1.5')
    ok(calls === 1, 'second resolve uses the cache')
    adapter.resetCache()
    await adapter.resolveModel('intern-modalities', 'glm-5.3')
    ok(calls === 2, 'cache miss refetches once')
  } finally {
    globalThis.fetch = original
  }
})

run(async () => {
  const adapter = new ModalitiesAdapter({
    endpoint: 'https://acme.test/v1',
    apiKey: 'sk-test',
  })
  const original = globalThis.fetch
  globalThis.fetch = stubFetch()
  try {
    await adapter.resolveModel('intern-modalities', 'nobody-here')
    ok(false, 'should throw for missing models')
  } catch (error) {
    ok(error instanceof LlmError, 'throws LlmError')
    ok(error.code === 'UNKNOWN_MODEL', `code is UNKNOWN_MODEL, got ${error.code}`)
  } finally {
    globalThis.fetch = original
  }
})

run(async () => {
  const adapter = new ModalitiesAdapter({
    endpoint: 'https://acme.test/v1',
    apiKey: 'sk-test',
  })
  const chunks = []
  const original = globalThis.fetch
  const payload = (delta, index) => JSON.stringify({ choices: [{ delta, index }] })
  globalThis.fetch = async () => new Response(
    'data: ' + payload({ content: 'hello' }, 0) + '\n\n' +
    'data: ' + payload({ content: ' world' }, 0) + '\n\n' +
    'data: ' + JSON.stringify({ choices: [], finish_reason: 'stop' }) + '\n\n',
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  )
  try {
    let collected = ''
    for await (const chunk of adapter.stream({
      model: 'Sage-A1.5',
      messages: [],
      signal: undefined,
    })) {
      if (chunk.type === 'text-delta') collected += chunk.text
      chunks.push(chunk.type)
    }
    ok(collected === 'hello world', `chunk text matched, got "${collected}"`)
    ok(chunks.includes('finish'), 'ends with a finish chunk')
  } finally {
    globalThis.fetch = original
  }
})

process.exitCode = await flush()
