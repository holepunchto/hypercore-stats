const test = require('brittle')
const Corestore = require('corestore')
const RAM = require('random-access-memory')
const HypercoreStats = require('.')
const promClient = require('prom-client')

const DEBUG = true

test('Can register and get prometheus metrics', async (t) => {
  const store = new Corestore(RAM)
  const core = store.get({ name: 'core' })
  const core2 = store.get({ name: 'core2' })

  const stats = new HypercoreStats()
  stats.registerPrometheusMetrics(promClient)

  stats.addCore(core)
  stats.addCore(core2)

  {
    const metrics = await promClient.register.metrics()
    const lines = metrics.split('\n')

    if (DEBUG) console.log(metrics)

    t.is(getMetricValue(lines, 'hypercore_total_cores'), 2, 'hypercore_total_cores')
    t.is(getMetricValue(lines, 'hypercore_total_length'), 0, 'hypercore_total_length init 0')
    t.is(getMetricValue(lines, 'hypercore_total_inflight_blocks'), 0, 'hypercore_total_inflight_blocks init 0')
    t.is(getMetricValue(lines, 'hypercore_total_max_inflight_blocks'), 0, 'hypercore_total_max_inflight_blocks init 0')
    t.is(getMetricValue(lines, 'hypercore_total_peers'), 0, 'hypercore_total_peers init 0')
  }

  await core.append('block0')
  await core.append('block1')
  await core2.append('block0')

  const store2 = new Corestore(RAM)
  const readCore = store2.get({ key: core.key })
  await readCore.ready()

  // Add error handlers if it turns out these can error
  const s1 = core.replicate(true)
  const s2 = readCore.replicate(false)
  s1.pipe(s2).pipe(s1)

  // DEVNOTE: The precise lifecycle of when a peer is added to
  // a core's replicator is complex (and there is no event for now).
  // Rather than waiting for the exact events,
  // we hack it out and wait a redundantly long time
  await new Promise(resolve => setTimeout(resolve, 100))

  {
    const metrics = await promClient.register.metrics()
    const lines = metrics.split('\n')

    if (DEBUG) console.log(metrics)

    // TODO: proper test of inflight metrics
    t.is(getMetricValue(lines, 'hypercore_total_length'), 3, 'hypercore_total_length')
    t.is(getMetricValue(lines, 'hypercore_total_peers'), 1, 'hypercore_total_peers')
  }
})

function getMetricValue (lines, name) {
  const match = lines.find((l) => l.startsWith(`${name} `))
  if (!match) throw new Error(`No match for ${name}`)

  const value = parseInt(match.split(' ')[1])
  if (DEBUG) console.log(name, '->', value)

  return value
}
