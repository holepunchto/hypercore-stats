class HypercoreStats {
  constructor () {
    this.cores = []
  }

  addCore (core) {
    this.cores.push(core)
  }

  get totalCores () {
    return this.cores.length
  }

  getTotalLength () {
    return this.cores.reduce(
      (sum, core) => sum + core.length,
      0
    )
  }

  getTotalPeers () {
    const uniquePeers = new Set()
    for (const core of this.cores) {
      for (const peer of core.peers) {
        // rawStream shared means it's the same socket
        // (easy way to count peers multiplexing over many cores only once)
        uniquePeers.add(peer.stream.rawStream)
      }
    }

    return uniquePeers.size
  }

  getTotalInflightBlocks () {
    return this.cores.reduce(
      (sum, core) => {
        return sum + core.peers.reduce(
          (coreSum, peer) => coreSum + peer.inflight,
          0
        )
      }, 0
    )
  }

  getTotalMaxInflightBlocks () {
    return this.cores.reduce(
      (sum, core) => {
        return sum + core.peers.reduce(
          (coreSum, peer) => coreSum + peer.getMaxInflight(),
          0
        )
      }, 0
    )
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

module.exports = HypercoreStats
