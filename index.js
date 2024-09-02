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
  }
}

class HypercoreStatsSnapshot {
  constructor (cores) {
    this.cores = cores

    this._totalPeersConns = new Set()

    this.totalWireSyncReceived = 0
    this.totalWireSyncTransmitted = 0
    this.totalWireRequestReceived = 0
    this.totalWireRequestTransmitted = 0
    this.totalWireCancelReceived = 0
    this.totalWireCancelTransmitted = 0
    this.totalWireDataReceived = 0
    this.totalWireDataTransmitted = 0
    this.totalWireWantReceived = 0
    this.totalWireWantTransmitted = 0
    this.totalWireBitfieldReceived = 0
    this.totalWireBitfieldTransmitted = 0
    this.totalWireRangeReceived = 0
    this.totalWireRangeTransmitted = 0
    this.totalWireExtensionReceived = 0
    this.totalWireExtensionTransmitted = 0

    this.totalCores = 0
    this.totalLength = 0
    this.totalInflightBlocks = 0
    this.totalMaxInflightBlocks = 0
    // this.totalBlocksUploaded = 0
    // this.totalBlocksDownloaded = 0
    // this.totalBytesUploaded = 0
    // this.totalBytesDownloaded = 0

    this.calculate()
  }

  get totalPeers () {
    return this._totalPeersConns.size
  }

  calculate () {
    this.totalCores = this.cores.length

    for (const core of this.cores) {
      this.totalLength += core.length
      // this.totalBlocksUploaded += core.stats.blocksUploaded
      // this.totalBlocksDownloaded += core.stats.blocksDownloaded
      // this.totalBytesUploaded += core.stats.bytesUploaded
      // this.totalBytesDownloaded += core.stats.bytesDownloaded

      if (core.replicator) {
        this.totalWireSyncReceived += core.replicator.stats.wireSync.rx
        this.totalWireSyncTransmitted += core.replicator.stats.wireSync.tx
        this.totalWireRequestReceived += core.replicator.stats.wireRequest.rx
        this.totalWireRequestTransmitted += core.replicator.stats.wireRequest.tx
        this.totalWireCancelReceived += core.replicator.stats.wireCancel.rx
        this.totalWireCancelTransmitted += core.replicator.stats.wireCancel.tx
        this.totalWireDataReceived += core.replicator.stats.wireData.rx
        this.totalWireDataTransmitted += core.replicator.stats.wireData.tx
        this.totalWireWantReceived += core.replicator.stats.wireWant.rx
        this.totalWireWantTransmitted += core.replicator.stats.wireWant.tx
        this.totalWireBitfieldReceived += core.replicator.stats.wireBitfield.rx
        this.totalWireBitfieldTransmitted += core.replicator.stats.wireBitfield.tx
        this.totalWireRangeReceived += core.replicator.stats.wireRange.rx
        this.totalWireRangeTransmitted += core.replicator.stats.wireRange.tx
        this.totalWireExtensionReceived += core.replicator.stats.wireExtension.rx
        this.totalWireExtensionTransmitted += core.replicator.stats.wireExtension.tx
      }

      for (const peer of core.peers) {
        this.totalInflightBlocks += peer.inflight
        this._totalPeersConns.add(peer.stream.rawStream)
        this.totalMaxInflightBlocks += peer.getMaxInflight()
      }
    }
  }
}

module.exports = HypercoreStats
