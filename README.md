# Hypercore Stats

Stats for Hypercores, with Prometheus support.

Assumes the hypercores are replicated over UDX streams. This is the case for all normal use-cases of hypercores (like replicating across hyperdht/hyperswarm).

## Install

```
npm i hypercore-stats
```

## Versions

- V1 works for Hypercore V10 and Corestore V6
- V2 works for Hypercore V11 and Corestore V7

## Usage

```js
const Corestore = require('corestore')
const HypercoreStats = require('hypercore-stats')
const promClient = require('prom-client')

const store = new Corestore('dummy-corestore')

const hypercoreStats = await HypercoreStats.fromCorestore(store)
hypercoreStats.registerPrometheusMetrics(promClient)

// The Prometheus metrics are typically collected by a metrics scraper, but we just print them here to illustrate
const metrics = await promClient.register.metrics()
console.log(metrics)
```

## Usage Without Prometheus

`hypercoreStats.toString()` returns a string representation of all stats.

`hypercoreStats.toJson()` returns a json representation of all stats.

## RocksDB Properties

`await hypercoreStats.getRocksdbProperties()` returns RocksDB integer properties (an empty object if no store was passed):

```js
{
  corestore: { 'live-sst-files-size': ..., ... }, // the hypercore data
  app: { 'live-sst-files-size': ..., ... } // default column family of the same rocksdb (whatever else the app stores there)
}
```

Some of them iterate over all sst/blob files, so the result is cached for `rocksdbPropertiesExpiryMs` (constructor option, default 60s).

They are exposed in Prometheus as `rocksdb_property_<name>{data="corestore"|"app"}`, with `-` replaced by `_`:

- `live_sst_files_size` / `total_sst_files_size`: SST files in the current version / all versions still referenced (bytes)
- `live_blob_file_size` / `total_blob_file_size`: blob files (values >= 4KB) in the current version / all versions still referenced (bytes)
- `live_blob_file_garbage_size`: dead bytes in blob files, waiting for blob garbage collection
- `num_blob_files`: number of blob files
- `estimate_live_data_size`: estimated live data (bytes); deleted data is only dropped after compaction
- `estimate_pending_compaction_bytes`: bytes compaction needs to rewrite to bring the levels back to target
- `num_running_compactions`: number of compactions currently running
- `estimate_num_keys`: estimated number of keys
