# Hypercore Stats

Stats for Hypercores, with Prometheus support.

Assumes the hypercores are replicated over UDX streams. This is the case for all normal use-cases of hypercores (like replicating across hyperdht/hyperswarm).

## Install

```
npm i hypercore-stats
```

## Versions

- V1.x.x works for Hypercore 10.x and Corestore 6.x
- V2.x.x works for Hypercore v11.x.x and Corestore v7.x.x

## Usage

```
const Corestore = require('corestore')
const HypercoreStats = require('hypercore-stats')
const promClient = require('prom-client')

const store = new Corestore('dummy-corestore')

const hypercoreStats = await HypercoreStats.fromCorestore(store)
hypercoreStats.registerPrometheusMetrics(promClient)

// The Prometheus metrics are typically exposed to a metrics scraper
const metrics = await promClient.register.metrics()
console.log(metrics)
```
