// ─── Barcode Scanner — FIFO Scan Queue ────────────────────────────────────────

import type { ScanInput } from './types'

type QueueProcessor = (scan: ScanInput) => Promise<void>

export class ScanQueue {
  private queue: ScanInput[] = []
  private processing = false
  private processor: QueueProcessor | null = null

  setProcessor(fn: QueueProcessor) {
    this.processor = fn
  }

  enqueue(scan: ScanInput) {
    this.queue.push(scan)
    this.drain()
  }

  private async drain() {
    if (this.processing || !this.processor) return
    const next = this.queue.shift()
    if (!next) return

    this.processing = true
    try {
      await this.processor(next)
    } catch (err) {
      console.error('[ScanQueue] Processor error:', err)
    } finally {
      this.processing = false
      if (this.queue.length > 0) this.drain()
    }
  }

  clear() {
    this.queue = []
  }

  get size() {
    return this.queue.length
  }
}
