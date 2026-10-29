/**
 * Assertion scaffolding for the plugin's readable test run: counts passes and
 * failures, then exits 0 for green, 1 for red.
 *
 * Async specs return a promise; `flush()` waits for every one before printing.
 */

/** The semantic: spec in, failures out. */
const KNOBS = { count: 0, pass: 0, failures: [] }
/** Promises returned by async specs, so flush() can await them. */
const PENDING = []

/** Push one failed assertion. */
export function assert(cond, label) {
  KNOBS.count += 1
  if (cond === true) KNOBS.pass += 1
  else KNOBS.failures.push(label)
}

/** Print one spec summary, then run it in-process.
 *
 * Specs run one at a time: each `runner` is awaited before the next starts,
 * so stubs and counters cannot collide between specs.
 */
export function run(runner) {
  const chain = PENDING.length > 0 ? Promise.all(PENDING) : Promise.resolve()
  PENDING.length = 0
  const result = chain.then(() => {
    try {
      return runner()
    } catch (error) {
      KNOBS.failures.push(`runner threw: ${error}`)
      KNOBS.count += 1
    }
  })
  PENDING.push(result.catch(error => {
    KNOBS.failures.push(`runner threw: ${error}`)
    KNOBS.count += 1
  }))
}

/** Wait for every async spec, report failures, and return the exit code. */
export async function flush() {
  if (PENDING.length > 0) await Promise.all(PENDING)
  for (const failure of KNOBS.failures) console.error(`FAIL ${failure}`)
  console.log(`installed ${KNOBS.pass}/${KNOBS.count} assertions${KNOBS.failures.length ? ' ' + KNOBS.failures.length + ' failures' : ''}`)
  return KNOBS.failures.length === 0 ? 0 : 1
}
