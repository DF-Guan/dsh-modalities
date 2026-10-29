/**
 * Spellings of `input_modalities` a gateway can answer: flat string list,
 * nested OpenRouter architecture spelling, camel spelling, object-array spelling
 * and unknown spellings. The adapter and the core must agree on the vocabulary.
 */
import { modalitiesOf, recordModels } from '../src/modality.js'
import { run, assert as ok, flush } from './suite.mjs'

run(() => {
  // 1. Object array — this is the endpoint spelling the discovery API answers;
  // filtering it for the strings `text`/`image` finds nothing (the reported bug).
  const objectArray = [
    { type: 'text', supported_inputs: { max_context_length: { value: 524288, unit: 'token' } } },
    { type: 'image', supported_inputs: { sources: { type: 'enum', values: ['url', 'base64'] } } },
  ]
  ok(JSON.stringify(modalitiesOf({ id: 'Sage-A1.5', input_modalities: objectArray })) === '["text","image"]', 'object-array spelling yields [text,image]')
  ok(JSON.stringify(modalitiesOf({ input_modalities: [{ type: 'text' }], })) === '["text"]', 'object single spelling')

  // 2. Flat string list.
  ok(JSON.stringify(modalitiesOf({ input_modalities: ['text', 'image'] })) === '["text","image"]', 'flat string list')
  ok(JSON.stringify(modalitiesOf({ input_modalities: ['text'] })) === '["text"]', 'flat single string')

  // 3. OpenRouter's nested architecture spelling; `file` is dropped.
  ok(JSON.stringify(modalitiesOf({ architecture: { input_modalities: ['text', 'image', 'file'] } })) === '["text","image"]', 'nested OpenRouter spelling')

  // 4. Camel spelling.
  ok(JSON.stringify(modalitiesOf({ inputModalities: ['text'] })) === '["text"]', 'camel spelling')

  // 5. Unknown spellings are rejected, not reported: no image, audio, video.
  ok(modalitiesOf({ input_modalities: [{ type: 'file' }, { type: 'audio' }] }) === undefined, 'unknown spellings stay unknown')
  ok(modalitiesOf({ input_modalities: [] }) === undefined, 'empty array is a no-op declaration')
  ok(modalitiesOf({ input_modalities: 'text' }) === undefined, 'non-array spelling is ignored')

  // 6. A listing copy of the discovery-api shape.
  const listing = {
    data: [
      { id: 'Sage-A1.5', name: 'Sage-A1.5', input_modalities: objectArray },
      { id: 'glm-5.3', name: 'GLM-5.3', input_modalities: [{ type: 'text', supported_inputs: { max_context_length: { value: 1048576, unit: 'token' } } }] },
      { id: 'intern-s2', name: '书生-S2', input_modalities: objectArray },
    ],
  }
  const models = recordModels(listing)
  ok(models.length === 3, 'counts all three rows')
  ok(models[0].id === 'Sage-A1.5', 'first row id')
  ok(JSON.stringify(models[0].inputModalities) === '["text","image"]', 'first row modalities')
  ok(JSON.stringify(models[1].inputModalities) === '["text"]', 'text-only row modalities')
  ok(models[2].name === '书生-S2', 'string name preservation')

  // 7. Empty objects in the `models` map yield nothing when no usable id exists.
  ok(JSON.stringify(recordModels({ models: {} })) === '[]', 'models map, empty')
  ok(JSON.stringify(recordModels({})) === '[]', 'no data or models field')

  // 8. Gateway rows with capacities keep the capacity spellings and the modalities.
  const capacityModels = recordModels({ data: [
    { id: 'gateway-cap', context_window: 1_048_576, max_output_tokens: 8192, input_modalities: ['text', 'image'] },
  ]})
  ok(capacityModels.length === 1, 'capacity row')
  ok(capacityModels[0].contextWindow === 1_048_576, 'row capacity window')
  ok(capacityModels[0].maxTokens === 8192, 'row capacity output')
  ok(JSON.stringify(capacityModels[0].inputModalities) === '["text","image"]', 'row modalities')
})

process.exitCode = await flush()
