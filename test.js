const test = require('brittle')
const Corestore = require('corestore')
const RAM = require('random-access-memory')
const HypercoreStats = require('.')
const promClient = require('prom-client')
const setupTestnet = require('hyperdht/testnet')
const Hyperswarm = require('hyperswarm')
const Rache = require('rache')

const DEBUG = false

test('Can register and get prometheus metrics', async (t) => {
  const store = new Corestore(RAM)
  const core = store.get({ name: 'core' })
  const core2 = store.get({ name: 'core2' })
  await core.ready()
  await core2.ready()

  const stats = new HypercoreStats()
  stats.registerPrometheusMetrics(promClient)
  t.teardown(() => {
    promClient.register.clear()
  })

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
    t.is(getMetricValue(lines, 'hypercore_round_trip_time_avg_seconds'), 0, 'hypercore_round_trip_time_avg_seconds init 0')

    // t.is(getMetricValue(lines, 'hypercore_total_blocks_downloaded'), 0, 'hypercore_total_blocks_downloaded init 0')
    // t.is(getMetricValue(lines, 'hypercore_total_blocks_uploaded'), 0, 'hypercore_total_blocks_uploaded init 0')
    // t.is(getMetricValue(lines, 'hypercore_total_bytes_downloaded'), 0, 'hypercore_total_bytes_downloaded init 0')
    // t.is(getMetricValue(lines, 'hypercore_total_bytes_uploaded'), 0, 'hypercore_total_bytes_uploaded init 0')

    t.is(getMetricValue(lines, 'hypercore_total_wire_sync_received'), 0, 'hypercore_total_wire_sync_received init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_sync_transmitted'), 0, 'hypercore_total_wire_sync_transmitted init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_request_received'), 0, 'hypercore_total_wire_request_received init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_request_transmitted'), 0, 'hypercore_total_wire_request_transmitted init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_cancel_received'), 0, 'hypercore_total_wire_cancel_received init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_cancel_transmitted'), 0, 'hypercore_total_wire_cancel_transmitted init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_data_received'), 0, 'hypercore_total_wire_data_received init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_data_transmitted'), 0, 'hypercore_total_wire_data_transmitted init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_want_received'), 0, 'hypercore_total_wire_want_received init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_want_transmitted'), 0, 'hypercore_total_wire_want_transmitted init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_bitfield_received'), 0, 'hypercore_total_wire_bitfield_received init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_bitfield_transmitted'), 0, 'hypercore_total_wire_bitfield_transmitted init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_range_received'), 0, 'hypercore_total_wire_range_received init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_range_transmitted'), 0, 'hypercore_total_wire_range_transmitted init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_extension_received'), 0, 'hypercore_total_wire_extension_received init 0')
    t.is(getMetricValue(lines, 'hypercore_total_wire_extension_transmitted'), 0, 'hypercore_total_wire_extension_transmitted init 0')
  }

  await core.append('block0')
  await core.append('block1')
  await core2.append('block0')

  const store2 = new Corestore(RAM)
  const readCore = store2.get({ key: core.key })
  await readCore.ready()

  // Some stats come from udx, so we need UDX streams
  // instead of directly replicating the hypercores.
  // Easiest to just use hyperswarm for that.
  const testnet = await setupTestnet()
  const bootstrap = testnet.bootstrap
  const swarm1 = new Hyperswarm({ bootstrap })
  swarm1.on('connection', (conn) => {
    store.replicate(conn)
  })
  const swarm2 = new Hyperswarm({ bootstrap })
  swarm2.on('connection', (conn) => {
    store2.replicate(conn)
  })

  swarm1.join(core.discoveryKey)
  await swarm1.flush()
  swarm2.join(core.discoveryKey)
  await new Promise(resolve => setImmediate(resolve))

  await readCore.get(0)
  // DEVNOTE: The precise lifecycle of when a peer is added to
  // a core's replicator is complex (and there is no event for now).
  // Rather than waiting for the exact events,
  // we hack it out and wait a redundantly long time
  // (same applies to when an update event is registered, but we could listen for that event)
  await new Promise(resolve => setTimeout(resolve, 1000))

  {
    stats.clearCache()
    const metrics = await promClient.register.metrics()
    const lines = metrics.split('\n')

    if (DEBUG) console.log(metrics)

    // TODO: proper test of inflight metrics
    t.is(getMetricValue(lines, 'hypercore_total_length'), 3, 'hypercore_total_length')
    t.is(getMetricValue(lines, 'hypercore_total_peers'), 1, 'hypercore_total_peers')
    t.is(getMetricValue(lines, 'hypercore_round_trip_time_avg_seconds') > 0, true, 'hypercore_round_trip_time_avg_seconds')
    // t.is(getMetricValue(lines, 'hypercore_total_blocks_downloaded'), 0, 'hypercore_total_blocks_downloaded')
    // t.is(getMetricValue(lines, 'hypercore_total_blocks_uploaded'), 1, 'hypercore_total_blocks_uploaded')
    // t.is(getMetricValue(lines, 'hypercore_total_bytes_downloaded'), 0, 'hypercore_total_bytes_downloaded')
    // t.ok(getMetricValue(lines, 'hypercore_total_bytes_uploaded') > 0, 'hypercore_total_bytes_uploaded')
    t.ok(getMetricValue(lines, 'hypercore_total_wire_sync_received') > 0, 'hypercore_total_wire_sync_received')
    t.ok(getMetricValue(lines, 'hypercore_total_wire_sync_transmitted') > 0, 'hypercore_total_wire_sync_transmitted')
    t.ok(getMetricValue(lines, 'hypercore_total_wire_want_received') > 0, 'hypercore_total_wire_want_received')
    t.ok(getMetricValue(lines, 'hypercore_total_wire_data_transmitted') > 0, 'hypercore_total_wire_data_transmitted')
    t.ok(getMetricValue(lines, 'hypercore_total_wire_request_received') > 0, 'hypercore_total_wire_request_received')
    t.ok(getMetricValue(lines, 'hypercore_total_wire_range_transmitted') > 0, 'hypercore_total_wire_range_transmitted')
  }

  await swarm1.destroy()
  await swarm2.destroy()
  await testnet.destroy()
})

test('Cache-expiry logic', async (t) => {
  const store = new Corestore(RAM)
  const core = store.get({ name: 'core' })
  await core.ready()

  const stats = new HypercoreStats({ cacheExpiryMs: 1000 })
  stats.registerPrometheusMetrics(promClient)
  t.teardown(() => {
    promClient.register.clear()
  })

  {
    const metrics = await promClient.register.metrics()

    const lines = metrics.split('\n')
    // if (DEBUG) console.log(metrics)
    t.is(getMetricValue(lines, 'hypercore_total_cores'), 0, 'init 0 (sanity check)')
  }

  stats.addCore(core)
  {
    const metrics = await promClient.register.metrics()

    const lines = metrics.split('\n')
    t.is(getMetricValue(lines, 'hypercore_total_cores'), 0, 'still cached 0 value')
  }

  await new Promise(resolve => setTimeout(resolve, 1000))
  {
    const metrics = await promClient.register.metrics()

    const lines = metrics.split('\n')
    t.is(getMetricValue(lines, 'hypercore_total_cores'), 1, 'cache busted after expire time')
  }
})

test('fromCorestore init', async (t) => {
  const store = new Corestore(RAM, { globalCache: new Rache() })
  const core = store.get({ name: 'core' })

  const stats = HypercoreStats.fromCorestore(store)
  await core.ready()
  t.is(stats.cores.size, 1, 'init core added')
  t.is(stats.totalGlobalCacheEntries, 0, 'total cache entries available when globalCache set')

  const core2 = store.get({ name: 'core2' })
  await core2.ready()
  t.is(stats.cores.size, 2, 'new core added')
})

function getMetricValue (lines, name) {
  const match = lines.find((l) => l.startsWith(`${name} `))
  if (!match) throw new Error(`No match for ${name}`)

  const value = parseFloat(match.split(' ')[1])
  if (DEBUG) console.log(name, '->', value)

  return value
}
