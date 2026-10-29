/**
 * The plugin entry point: registers a provider adapter with the harness over
 * the plugin configuration, and resolves the loader's injected session
 * services (`llm`, `cordis`).
 *
 * The adapter is applied as the row `dsh-modalities` gets
 * loaded; users override the configuration of the row in their profile patch.
 *
 * Plugin contract: `name`, `inject`, `apply(ctx, config)`.
 */

import { ModalitiesAdapter } from './provider.js'

export const name = 'dsh-modalities'
export const inject = ['llm']
export const entry = 'apply'

/** Plugin configuration: one gateway to drive, one provider route to own.
 * @typedef {Object} Config
 * @property {string} Config.endpoint - Gateway endpoint that answers `GET {endpoint}/v1/models`.
 * @property {string} Config.apiKey - API key passed to the gateway in every request.
 * @property {string[]} Config.providers - Provider routes this adapter owns.
 */

/**
 * Validate the configuration the cordis loader passes at load time.
 */
export function validate(config) {
  if (typeof config.endpoint !== 'string' || config.endpoint.trim().length === 0) throw new Error('endpoint must be a non-empty url')
  if (typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0) throw new Error('apiKey must be a non-empty token')
  if (!Array.isArray(config.providers) || config.providers.length === 0) throw new Error('providers must name at least one route')
  return config
}

export function apply(ctx, config) {
  const validated = validate(config)
  ctx.llm.registerAdapter(validated.providers, new ModalitiesAdapter(validated))
}
