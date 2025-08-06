const { once } = require('events')
const test = require('brittle')
const Corestore = require('corestore')
const getTmp = require('test-tmp')
const HypercoreStats = require('.')
const promClient = require('prom-client')
const setupTestnet = require('hyperdht/testnet')
const Hyperswarm = require('hyperswarm')
const Rache = require('rache')

const DEBUG = false

test('Can register and get prometheus metrics', async (t) => {
  const store = new Corestore(await getTmp(t))
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
    t.ok(getMetricValue(lines, 'hypercore_sessions_total') > 0, 'hypercore_sessions_total')

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

    t.is(getMetricValue(lines, 'hypercore_invalid_data'), 0, 'hypercore_invalid_data init 0')
    t.is(getMetricValue(lines, 'hypercore_invalid_requests'), 0, 'hypercore_invalid_requests init 0')
  }

  await core.append('block0')
  await core.append('block1')
  await core2.append('block0')

  const store2 = new Corestore(await getTmp(t))
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
    // TODO: figure out why it's sometimes zero still
    // t.is(getMetricValue(lines, 'hypercore_round_trip_time_avg_seconds') > 0, true, 'hypercore_round_trip_time_avg_seconds')

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

test('Expected amount of stats + sonsistent between prometheus, json and str', async (t) => {
  const store = new Corestore(await getTmp(t))
  const core = store.get({ name: 'core' })
  await core.append('block 1')

  const stats = HypercoreStats.fromCorestore(store)
  stats.registerPrometheusMetrics(promClient)
  t.teardown(() => {
    promClient.register.clear()
  })

  const nrPromMetrics = (await promClient.register.metrics()).split('\n\n').length
  const nrJsonMetrics = [...Object.keys(stats.toJson())].length
  const nrTxtMetrics = stats.toString().split('\n').length - 1

  t.is(nrPromMetrics, 28, 'expected amount of stats')
  t.is(nrPromMetrics, nrJsonMetrics, 'consistent amount of prometheus and json metrics')
  t.is(nrTxtMetrics, nrJsonMetrics, 'consistent amount of txt and json metrics')
})

test('Cache-expiry logic', async (t) => {
  const store = new Corestore(await getTmp(t))
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
    if (DEBUG) console.log(metrics)
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
  const store = new Corestore(await getTmp(t), { globalCache: new Rache() })
  const core = store.get({ name: 'core' })

  const stats = HypercoreStats.fromCorestore(store)
  await core.ready()
  t.is(stats.cores.size, 1, 'init core added')
  t.is(stats.totalGlobalCacheEntries, 0, 'total cache entries available when globalCache set')

  const core2 = store.get({ name: 'core2' })
  await core2.ready()
  t.is(stats.cores.size, 2, 'new core added')
})

test('gc core if removed from corestore', async (t) => {
  const store = new Corestore(await getTmp(t))
  const store2 = new Corestore(await getTmp(t))
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

  const core1 = store.get({ name: 'core' })
  const core2 = store.get({ name: 'core2' })
  await core1.ready()
  await core2.ready()

  swarm1.join(core1.discoveryKey)
  await swarm1.flush()

  // DEVNOTE: unsure if cores are guaranteed to stay
  // open with the new storage engine, so we might need
  // to keep them open explicitly
  await core1.append('block0')
  await core1.append('block1')

  const readCore = store2.get({ key: core1.key })
  await readCore.ready()
  swarm2.join(readCore.discoveryKey)
  await readCore.get(1)

  const stats = HypercoreStats.fromCorestore(store)
  await new Promise(resolve => {
    let count = 0
    stats.on('add-core', () => {
      if (++count >= 2) {
        resolve()
        stats.off('add-core')
      }
    })
  })

  t.is(stats.cores.size, 2, 'cores added')
  t.is(stats.persistedStats.totalWireRequestReceived, 0, 'nothing persisted yet (sanity check)')
  const wireReqRx = stats.totalWireRequestReceived
  t.ok(wireReqRx > 0, 'We did receive wire reqs (sanity check')

  t.is(stats.cores.size, 2, 'sanity check')

  await Promise.all([
    once(stats, 'gc'), // Takes several seconds due to internal corestore pool logic
    core1.close(),
    swarm1.destroy() // We need to kill the replication session too
  ])

  stats.bustCache()

  t.is(stats.cores.size, 1, 'core got removed')
  t.is(stats.totalWireRequestReceived, wireReqRx, 'uses persisted stats')
  await swarm2.destroy()
  await testnet.destroy()
})

function getMetricValue (lines, name) {
  const match = lines.find((l) => l.startsWith(`${name} `))
  if (!match) throw new Error(`No match for ${name}`)

  const value = parseFloat(match.split(' ')[1])
  if (DEBUG) console.log(name, '->', value)

  return value
}
