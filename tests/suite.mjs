/**
 * Assertion scaffolding for the plugin's readable test run: counts passes and
 * failures, then exits 0 for green, 1 for red.
 */

/** The semantic: spec in, failures out. */
const KNOBS = { count: 0, pass: 0, failures: [] }

/** Push one failed assertion. */
export function assert(cond, label) {
  KNOBS.count += 1
  if (cond === true) KNOBS.pass += 1
  else KNOBS.failures.push(label)
}

/** Print one spec summary, then run it in-process. */
export function run(runner) {
  try {
    runner()
  } catch (error) {
    KNOBS.failures.push(`runner threw: ${error}`)
    KNOBS.count += 1
  }
}

export function flush() {
  for (const failure of KNOBS.failures) console.error(`FAIL ${failure}`)
  console.log(`installed ${KNOBS.pass}/${KNOBS.count} assertions${KNOBS.failures.length ? ' ' + KNOBS.failures.length + ' failures' : ''}`)
  return KNOBS.failures.length === 0 ? 0 : 1
}
