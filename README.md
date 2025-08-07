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

```
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
