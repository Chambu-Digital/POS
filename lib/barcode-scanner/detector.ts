// ─── Barcode Scanner — Keyboard Input Detector ────────────────────────────────
// Detects scanner input vs human typing by measuring keystroke speed and burst length.

import type { ScanInput, ScannerConfig } from './types'

interface DetectorCallbacks {
  onScanDetected: (scan: ScanInput) => void
  onStateChange?: (state: 'IDLE' | 'DETECTING') => void
}

export class KeyboardScanDetector {
  private buffer = ''
  private lastKeyTime = 0
  private keystrokeTimes: number[] = []
  private resetTimer: ReturnType<typeof setTimeout> | null = null
  private config: ScannerConfig
  private callbacks: DetectorCallbacks
  private boundHandler: (e: KeyboardEvent) => void

  constructor(config: ScannerConfig, callbacks: DetectorCallbacks) {
    this.config = config
    this.callbacks = callbacks
    this.boundHandler = this.handleKeyDown.bind(this)
  }

  attach() {
    window.addEventListener('keydown', this.boundHandler, true)
  }

  detach() {
    window.removeEventListener('keydown', this.boundHandler, true)
    this.reset()
  }

  private handleKeyDown(e: KeyboardEvent) {
    // Ignore modifier-only keys
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return

    // If user is typing in an input/textarea/select, only intercept if it looks like a scanner
    const target = e.target as HTMLElement
    const isFormField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)

    const now = Date.now()
    const delta = now - this.lastKeyTime

    if (e.key === 'Enter') {
      if (this.buffer.length >= this.config.minLength) {
        const avgSpeed = this.averageKeystrokeSpeed()
        const looksLikeScanner = avgSpeed < this.config.keystrokeThreshold &&
          this.keystrokeTimes.length >= this.config.minBurstLength

        if (looksLikeScanner || !isFormField) {
          if (looksLikeScanner) {
            e.preventDefault()
            e.stopPropagation()
          }
          this.emit(this.buffer)
        }
      }
      this.reset()
      return
    }

    // If in a form field and typing slowly, don't intercept
    if (isFormField && delta > this.config.keystrokeThreshold && this.buffer.length === 0) {
      return
    }

    // Start or continue buffering
    if (delta > this.config.keystrokeThreshold * 3 && this.buffer.length === 0) {
      // First key of a potential scan
      this.callbacks.onStateChange?.('DETECTING')
    }

    if (e.key.length === 1) {
      this.buffer += e.key
      this.keystrokeTimes.push(now)
      this.lastKeyTime = now
    }

    // Schedule auto-flush for scanners without Enter suffix
    if (this.resetTimer) clearTimeout(this.resetTimer)
    this.resetTimer = setTimeout(() => {
      if (this.buffer.length >= this.config.minLength) {
        const avgSpeed = this.averageKeystrokeSpeed()
        if (avgSpeed < this.config.keystrokeThreshold &&
          this.keystrokeTimes.length >= this.config.minBurstLength) {
          this.emit(this.buffer)
        }
      }
      this.reset()
    }, this.config.keystrokeThreshold * 3)
  }

  private averageKeystrokeSpeed(): number {
    if (this.keystrokeTimes.length < 2) return Infinity
    const deltas: number[] = []
    for (let i = 1; i < this.keystrokeTimes.length; i++) {
      deltas.push(this.keystrokeTimes[i] - this.keystrokeTimes[i - 1])
    }
    return deltas.reduce((a, b) => a + b, 0) / deltas.length
  }

  private emit(code: string) {
    const normalized = this.normalize(code)
    if (!normalized) return
    this.callbacks.onScanDetected({
      code: normalized,
      source: 'scanner',
      timestamp: Date.now(),
    })
  }

  private normalize(code: string): string {
    let c = code.trim()
    if (this.config.prefix && c.startsWith(this.config.prefix)) {
      c = c.slice(this.config.prefix.length)
    }
    if (this.config.suffix && c.endsWith(this.config.suffix)) {
      c = c.slice(0, -this.config.suffix.length)
    }
    return c
  }

  private reset() {
    this.buffer = ''
    this.lastKeyTime = 0
    this.keystrokeTimes = []
    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
      this.resetTimer = null
    }
    this.callbacks.onStateChange?.('IDLE')
  }
}
