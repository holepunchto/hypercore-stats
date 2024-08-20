class HypercoreStats {
  constructor ({ cacheExpiryMs = 5000 } = {}) {
    this.cores = []
    this.cacheExpiryMs = cacheExpiryMs

    // DEVNOTE: We calculate the stats all at once to avoid iterating over
    // all cores and their peers multiple times (once per metric)
    // However, prometheus' scrape model does not support any state.
    // So there is no explicit way to precalculate all stats for one scrape
    // As a workaround, we cache the calculated stats for a short time
    // (but a lot longer than a scrape action should take)
    // That way a single scrape action should returns stats
    // calculated from the same snapshot.
    // The edge cases happen when:
    // - 2 scrape requests arrive within less (or not much more) time than the cacheExpiry
    // - The stats api is accessed programatically outside of prometheus scraping
    // - scraping takes > cacheExpiry (but that should never be the case)
    //  The edge cases aren't dramatic: it just means that different stats are taken 5s apart
    this._cachedStats = null
  }

  addCore (core) {
    this.cores.push(core)
  }

  get totalCores () {
    return this._getStats().totalCores
  }

  getTotalLength () {
    return this._getStats().totalLength
  }

  getTotalPeers () {
    return this._getStats().totalPeers
  }

  getTotalInflightBlocks () {
    return this._getStats().totalInflightBlocks
  }

  getTotalMaxInflightBlocks () {
    return this._getStats().totalMaxInflightBlocks
  }

  // Caches the result for this._lastStatsCalcTime ms
  _getStats () {
    if (this._cachedStats && this._lastStatsCalcTime + this.cacheExpiryMs > Date.now()) {
      return this._cachedStats
    }

    this._cachedStats = new HypercoreStatsSnapshot(this.cores)
    this._lastStatsCalcTime = Date.now()
    return this._cachedStats
  }

  clearCache () {
    this._cachedStats = null
  }

  registerPrometheusMetrics (promClient) {
    const self = this

    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_cores',
      help: 'Total amount of hypercores',
      collect () {
        this.set(self.totalCores)
      }
    })

    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_length',
      help: 'Total length of all hypercores',
      collect () {
        this.set(self.getTotalLength())
      }
    })

    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_inflight_blocks',
      help: 'Total amount of inflight blocks (summed across all cores)',
      collect () {
        this.set(self.getTotalInflightBlocks())
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_max_inflight_blocks',
      help: 'Total amount of maxInflight blocks (summed across all cores)',
      collect () {
        this.set(self.getTotalInflightBlocks())
      }
    })

    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_peers',
      help: 'Total amount of unique peers across all cores',
      collect () {
        this.set(self.getTotalPeers())
      }
    })
  }
}

class HypercoreStatsSnapshot {
  constructor (cores) {
    this.cores = cores

    this._totalPeersConns = new Set()
    this.totalCores = 0
    this.totalLength = 0
    this.totalInflightBlocks = 0
    this.totalMaxInflightBlocks = 0

    this.calculate()
  }

  get totalPeers () {
    return this._totalPeersConns.size
  }

  calculate () {
    this.totalCores = this.cores.length

    for (const core of this.cores) {
      this.totalLength += core.length

      for (const peer of core.peers) {
        this.totalInflightBlocks += peer.inflight
        this._totalPeersConns.add(peer.stream.rawStream)
        this.totalMaxInflightBlocks += peer.getMaxInflight()
      }
    }
  }
}

module.exports = HypercoreStats
