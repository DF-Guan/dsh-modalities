/**
 * A provider adapter whose listing maps gateway `input_modalities` into the
 * harness vocabulary. It demonstrates the gateway path: an endpoint whose
 * listing reports modalities as objects (`[{ type: "image" }]`) lands with
 * `inputModalities` intact, so image caps resolve correctly.
 */

import { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import { recordModels, modalitiesOf } from './modality.js'
import { translateSse } from './sse.js'

/** How long a gateway listing stays authoritative in this adapter. */
const LISTING_TTL_MS = 10 * 60 * 1000

export class ModalitiesAdapter extends LlmAdapter {
  /** Cached gateway listing, empty until first resolution. */
  #listing = null

  /** The raw endpoint without trailing slashes. */
  #endpoint
  /** API key passed to the gateway in every request. */
  #apiKey

  constructor({ endpoint, apiKey }) {
    super()
    this.#endpoint = endpoint.replace(/\/+$/, '')
    this.#apiKey = apiKey
  }

  providerInfo(provider) { return { id: provider, name: 'Modality' } }

  /** Invalidate the cached listing, forcing a refetch. */
  resetCache() { this.#listing = null }

  async requestBody(options) {
    const body = {
      model: options.model,
      messages: options.messages,
      ...options.temperature === undefined ? {} : { temperature: options.temperature },
      ...options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens },
      ...options.stop === undefined ? {} : { stop: options.stop },
      ...options.tools === undefined ? {} : { tools: options.tools },
    }
    return JSON.stringify(body)
  }

  /**
   * Answer from the endpoint listing: it is the authority for a gateway that
   * declares models by id.
   * @param options - the full request, whose model the adapter owns.
   * @returns the translated stream of harness chunks.
   */
  async * stream(options) {
    const requestBody = await this.requestBody(options)
    const response = await fetch(`${this.#endpoint}/v1/chat/completions`, {
      method: 'POST',
      signal: options.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.#apiKey}`,
        ...attributionHeaders(),
      },
      body: requestBody,
    })
    if (!response.ok) {
      throw new LlmError(`Adapter error: ${response.status}`, 'PROVIDER_HTTP_ERROR', { status: response.status })
    }
    yield* translateSse(response, options.signal)
  }

  /**
   * Translate one gateway `/models` reply into adapter-visible models.
   * @param provider - one provider route owned by this adapter.
   * @returns models in the endpoint listing order.
   */
  async listModels(provider) {
    const models = await this.models()
    return models.map(model => ({
      provider, id: model.id, name: model.name ?? model.id,
      inputModalities: model.inputModalities,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
    }))
  }

  /**
   * Resolve the metadata for one exact model by id. Modalities come from the
   * listing, not from a convention, so the route is claimed correctly.
   * @param provider - one provider route owned by this adapter.
   * @param model - exact model id passed to generate.
   * @param signal - caller cancellation, supported.
   * @returns the adapter-approved model metadata.
   */
  async resolveModel(provider, model, signal) {
    const models = await this.listModels(provider)
    const found = models.find(entry => entry.id === model)
    if (found === undefined) throw new LlmError(`Model "${model}" is not part of the gateway listing`, 'UNKNOWN_MODEL')
    return found
  }

  async models() {
    const cached = this.#listing
    if (cached && Date.now() - cached.cachedAt < LISTING_TTL_MS) return cached.models

    const response = await fetch(`${this.#endpoint}/v1/models`, {
      headers: { authorization: `Bearer ${this.#apiKey}`, accept: 'application/json', ...attributionHeaders() },
    })
    if (!response.ok) throw new LlmError(`Adapter error: ${response.status}`, 'PROVIDER_HTTP_ERROR', { status: response.status })
    const body = await response.json()
    const models = recordModels(body)
    this.#listing = { cachedAt: Date.now(), models }
    return models
  }
}
