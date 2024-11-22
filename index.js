const b4a = require('b4a')

class HypercoreStats {
  constructor ({ cacheExpiryMs = 5000 } = {}) {
    this.cores = new Map()
    this.cacheExpiryMs = cacheExpiryMs
    this._globalCache = null

    this.persistedStats = initPersistedStats()

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
    if (!core.key) {
      throw new Error('Can only add a core after its key is set (await ready)')
    }

    if (!this._globalCache && core.globalCache) {
      this._globalCache = core.globalCache
    }

    // Note: if a core with that key was already added,
    // it gets overwritten
    // DEVNOTE: this assumes we do not add any state to the hypercores
    // (so no event handlers)
    this.cores.set(b4a.toString(core.key, 'hex'), core)
  }

  gcCore (core) {
    if (!core.key) return // TODO: figure out if this is even possible

    const id = b4a.toString(core.key, 'hex')
    const entry = this.cores.get(id)
    if (!entry) return

    this.cores.delete(id)

    // Persist those stats we sum across all cores
    processPersistedStats(this.persistedStats, core)
  }

  bustCache () {
    this._cachedStats = null
  }

  get totalCores () {
    return this._getStats().totalCores
  }

  get totalFullyDownloadedCores () {
    return this._getStats().fullyDownloadedCores
  }

  get totalGlobalCacheEntries () {
    if (this._globalCache) {
      return this._globalCache.globalSize
    }
    return null
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

  getAvgRoundTripTimeMs () {
    return this._getStats().avgRoundTripTimeMs
  }

  getTotalSessions () {
    return this._getStats().totalSessions
  }

  // getTotalBlocksUploaded () {
  //   return this._getStats().totalBlocksUploaded
  // }

  // getTotalBlocksDownloaded () {
  //   return this._getStats().totalBlocksDownloaded
  // }

  // getTotalBytesUploaded () {
  //   return this._getStats().totalBytesUploaded
  // }

  // getTotalBytesDownloaded () {
  //   return this._getStats().totalBytesDownloaded
  // }

  get totalWireSyncReceived () {
    return this._getStats().totalWireSyncReceived
  }

  get totalWireSyncTransmitted () {
    return this._getStats().totalWireSyncTransmitted
  }

  get totalWireRequestReceived () {
    return this._getStats().totalWireRequestReceived
  }

  get totalWireRequestTransmitted () {
    return this._getStats().totalWireRequestTransmitted
  }

  get totalWireCancelReceived () {
    return this._getStats().totalWireCancelReceived
  }

  get totalWireCancelTransmitted () {
    return this._getStats().totalWireCancelTransmitted
  }

  get totalWireDataReceived () {
    return this._getStats().totalWireDataReceived
  }

  get totalWireDataTransmitted () {
    return this._getStats().totalWireDataTransmitted
  }

  get totalWireWantReceived () {
    return this._getStats().totalWireWantReceived
  }

  get totalWireWantTransmitted () {
    return this._getStats().totalWireWantTransmitted
  }

  get totalWireBitfieldReceived () {
    return this._getStats().totalWireBitfieldReceived
  }

  get totalWireBitfieldTransmitted () {
    return this._getStats().totalWireBitfieldTransmitted
  }

  get totalWireRangeReceived () {
    return this._getStats().totalWireRangeReceived
  }

  get totalWireRangeTransmitted () {
    return this._getStats().totalWireRangeTransmitted
  }

  get totalWireExtensionReceived () {
    return this._getStats().totalWireExtensionReceived
  }

  get totalWireExtensionTransmitted () {
    return this._getStats().totalWireExtensionTransmitted
  }

  get totalHotswaps () {
    return this._getStats().totalHotswaps
  }

  // Caches the result for this._lastStatsCalcTime ms
  _getStats () {
    if (this._cachedStats && this._lastStatsCalcTime + this.cacheExpiryMs > Date.now()) {
      return this._cachedStats
    }

    this._cachedStats = new HypercoreStatsSnapshot([...this.cores.values()], { ...this.persistedStats })
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
      name: 'hypercore_total_fully_downloaded_cores',
      help: 'Total amount of fully downloaded hypercores (where its length equals its contiguous length)',
      collect () {
        this.set(self.totalFullyDownloadedCores)
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
        this.set(self.getTotalMaxInflightBlocks())
      }
    })

    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_peers',
      help: 'Total amount of unique peers across all cores',
      collect () {
        this.set(self.getTotalPeers())
      }
    })

    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_round_trip_time_avg_seconds',
      help: 'Average round-trip time (rtt) for the open replication streams',
      collect () {
        this.set(self.getAvgRoundTripTimeMs() / 1000)
      }
    })

    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_sessions_total',
      help: 'Total amount of hypercore sessions, across all cores',
      collect () {
        this.set(self.getTotalSessions())
      }
    })

    /*
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_blocks_uploaded',
      help: 'Total amount of blocks uploaded across all cores',
      collect () {
        this.set(self.getTotalBlocksUploaded())
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_blocks_downloaded',
      help: 'Total amount of blocks downloaded across all cores',
      collect () {
        this.set(self.getTotalBlocksDownloaded())
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_bytes_uploaded',
      help: 'Total amount of bytes uploaded across all cores',
      collect () {
        this.set(self.getTotalBytesUploaded())
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_bytes_downloaded',
      help: 'Total amount of bytes downloaded across all cores',
      collect () {
        this.set(self.getTotalBytesDownloaded())
      }
    }) */

    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_sync_received',
      help: 'Total amount of wire-sync messages received across all cores',
      collect () {
        this.set(self.totalWireSyncReceived)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_sync_transmitted',
      help: 'Total amount of wire-sync messages transmitted across all cores',
      collect () {
        this.set(self.totalWireSyncTransmitted)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_request_received',
      help: 'Total amount of wire-request messages received across all cores',
      collect () {
        this.set(self.totalWireRequestReceived)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_request_transmitted',
      help: 'Total amount of wire-request messages transmitted across all cores',
      collect () {
        this.set(self.totalWireRequestTransmitted)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_cancel_received',
      help: 'Total amount of wire-cancel messages received across all cores',
      collect () {
        this.set(self.totalWireCancelReceived)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_cancel_transmitted',
      help: 'Total amount of wire-cancel messages transmitted across all cores',
      collect () {
        this.set(self.totalWireCancelTransmitted)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_data_received',
      help: 'Total amount of wire-data messages received across all cores',
      collect () {
        this.set(self.totalWireDataReceived)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_data_transmitted',
      help: 'Total amount of wire-data messages transmitted across all cores',
      collect () {
        this.set(self.totalWireDataTransmitted)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_want_received',
      help: 'Total amount of wire-want messages received across all cores',
      collect () {
        this.set(self.totalWireWantReceived)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_want_transmitted',
      help: 'Total amount of wire-want messages transmitted across all cores',
      collect () {
        this.set(self.totalWireWantTransmitted)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_bitfield_received',
      help: 'Total amount of wire-bitfield messages received across all cores',
      collect () {
        this.set(self.totalWireBitfieldReceived)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_bitfield_transmitted',
      help: 'Total amount of wire-bitfield messages transmitted across all cores',
      collect () {
        this.set(self.totalWireBitfieldTransmitted)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_range_received',
      help: 'Total amount of wire-range messages received across all cores',
      collect () {
        this.set(self.totalWireRangeReceived)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_range_transmitted',
      help: 'Total amount of wire-range messages transmitted across all cores',
      collect () {
        this.set(self.totalWireRangeTransmitted)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_extension_received',
      help: 'Total amount of wire-extension messages received across all cores',
      collect () {
        this.set(self.totalWireExtensionReceived)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_wire_extension_transmitted',
      help: 'Total amount of wire-extension messages transmitted across all cores',
      collect () {
        this.set(self.totalWireExtensionTransmitted)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_total_hotswaps',
      help: 'Total amount of hotswaps scheduled',
      collect () {
        this.set(self.totalHotswaps)
      }
    })
    new promClient.Gauge({ // eslint-disable-line no-new
      name: 'hypercore_global_cache_entries_total',
      help: 'Total amount of global cache entries',
      collect () {
        if (self.totalGlobalCacheEntries !== null) {
          this.set(self.totalGlobalCacheEntries)
        }
      }
    })
  }

  static fromCorestore (store) {
    const hypercoreStats = new this()
    store.on('core-open', core => {
      hypercoreStats.addCore(core)
    })
    store.on('core-close', core => {
      if (store.closing) return
      hypercoreStats.gcCore(core)
    })

    // Add already-opened cores
    for (const core of [...store.cores.values()]) {
      // DEVNOTE: core-open is emitted after a core is ready
      // so if not yet opened, we will process it then
      if (core.opened === true) {
        hypercoreStats.addCore(core)
      }
    }

    return hypercoreStats
  }
}

class HypercoreStatsSnapshot {
  constructor (cores, persistedStats) {
    this.cores = cores
    this.fullyDownloadedCores = 0

    this._totalPeersConns = new Set()
    this._totalPeerCoreCombos = 0

    this.totalWireSyncReceived = persistedStats.totalWireSyncReceived
    this.totalWireSyncTransmitted = persistedStats.totalWireSyncTransmitted
    this.totalWireRequestReceived = persistedStats.totalWireRequestReceived
    this.totalWireRequestTransmitted = persistedStats.totalWireRequestTransmitted
    this.totalWireCancelReceived = persistedStats.totalWireCancelReceived
    this.totalWireCancelTransmitted = persistedStats.totalWireCancelTransmitted
    this.totalWireDataReceived = persistedStats.totalWireDataReceived
    this.totalWireDataTransmitted = persistedStats.totalWireDataTransmitted
    this.totalWireWantReceived = persistedStats.totalWireWantReceived
    this.totalWireWantTransmitted = persistedStats.totalWireWantTransmitted
    this.totalWireBitfieldReceived = persistedStats.totalWireBitfieldReceived
    this.totalWireBitfieldTransmitted = persistedStats.totalWireBitfieldTransmitted
    this.totalWireRangeReceived = persistedStats.totalWireRangeReceived
    this.totalWireRangeTransmitted = persistedStats.totalWireRangeTransmitted
    this.totalWireExtensionReceived = persistedStats.totalWireExtensionReceived
    this.totalWireExtensionTransmitted = persistedStats.totalWireExtensionTransmitted
    this.totalHotswaps = persistedStats.totalHotswaps

    this.totalCores = 0
    this.totalLength = 0
    this.totalInflightBlocks = 0
    this.totalMaxInflightBlocks = 0
    this._totalRoundTripTime = 0
    this.totalSessions = 0
    // this.totalBlocksUploaded = 0
    // this.totalBlocksDownloaded = 0
    // this.totalBytesUploaded = 0
    // this.totalBytesDownloaded = 0

    this.calculate()
  }

  get totalPeers () {
    return this._totalPeersConns.size
  }

  get avgRoundTripTimeMs () {
    return this._totalPeerCoreCombos === 0
      ? 0
      : this._totalRoundTripTime / this._totalPeerCoreCombos
  }

  calculate () {
    this.totalCores = this.cores.length

    for (const core of this.cores) {
      this.totalLength += core.length
      if (core.length === core.contiguousLength) this.fullyDownloadedCores++

      this.totalSessions += core.sessions.length
      // this.totalBlocksUploaded += core.stats.blocksUploaded
      // this.totalBlocksDownloaded += core.stats.blocksDownloaded
      // this.totalBytesUploaded += core.stats.bytesUploaded
      // this.totalBytesDownloaded += core.stats.bytesDownloaded

      processPersistedStats(this, core)

      for (const peer of core.peers) {
        this._totalPeerCoreCombos++
        const udxStream = peer.stream.rawStream
        this.totalInflightBlocks += peer.inflight
        this._totalPeersConns.add(udxStream)
        this.totalMaxInflightBlocks += peer.getMaxInflight()
        this._totalRoundTripTime += udxStream.rtt
      }
    }
  }
}

function processPersistedStats (stats, core) {
  if (core.replicator) {
    stats.totalWireSyncReceived += core.replicator.stats.wireSync.rx
    stats.totalWireSyncTransmitted += core.replicator.stats.wireSync.tx
    stats.totalWireRequestReceived += core.replicator.stats.wireRequest.rx
    stats.totalWireRequestTransmitted += core.replicator.stats.wireRequest.tx
    stats.totalWireCancelReceived += core.replicator.stats.wireCancel.rx
    stats.totalWireCancelTransmitted += core.replicator.stats.wireCancel.tx
    stats.totalWireDataReceived += core.replicator.stats.wireData.rx
    stats.totalWireDataTransmitted += core.replicator.stats.wireData.tx
    stats.totalWireWantReceived += core.replicator.stats.wireWant.rx
    stats.totalWireWantTransmitted += core.replicator.stats.wireWant.tx
    stats.totalWireBitfieldReceived += core.replicator.stats.wireBitfield.rx
    stats.totalWireBitfieldTransmitted += core.replicator.stats.wireBitfield.tx
    stats.totalWireRangeReceived += core.replicator.stats.wireRange.rx
    stats.totalWireRangeTransmitted += core.replicator.stats.wireRange.tx
    stats.totalWireExtensionReceived += core.replicator.stats.wireExtension.rx
    stats.totalWireExtensionTransmitted += core.replicator.stats.wireExtension.tx
    stats.totalHotswaps += core.replicator.stats.hotswaps || 0
  }
}

function initPersistedStats () {
  const stats = {}
  stats.totalWireSyncReceived = 0
  stats.totalWireSyncTransmitted = 0
  stats.totalWireRequestReceived = 0
  stats.totalWireRequestTransmitted = 0
  stats.totalWireCancelReceived = 0
  stats.totalWireCancelTransmitted = 0
  stats.totalWireDataReceived = 0
  stats.totalWireDataTransmitted = 0
  stats.totalWireWantReceived = 0
  stats.totalWireWantTransmitted = 0
  stats.totalWireBitfieldReceived = 0
  stats.totalWireBitfieldTransmitted = 0
  stats.totalWireRangeReceived = 0
  stats.totalWireRangeTransmitted = 0
  stats.totalWireExtensionReceived = 0
  stats.totalWireExtensionTransmitted = 0
  stats.totalHotswaps = 0

  return stats
}

module.exports = HypercoreStats
