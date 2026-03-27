'use client'

// ─── useBarcodeScanner ─────────────────────────────────────────────────────────
// Central hook that wires together: detector → queue → processor → callbacks

import { useEffect, useRef, useCallback, useState } from 'react'
import { KeyboardScanDetector } from '@/lib/barcode-scanner/detector'
import { ScanQueue } from '@/lib/barcode-scanner/scan-queue'
import { processScan } from '@/lib/barcode-scanner/processor'
import { assertTransition } from '@/lib/barcode-scanner/state-machine'
import {
  DEFAULT_SCANNER_CONFIG,
  type ScanInput,
  type ScanResult,
  type ScannerState,
  type ScannerContext,
  type ScannerConfig,
} from '@/lib/barcode-scanner/types'

interface UseBarcodeScanner {
  /** Current state machine state */
  state: ScannerState
  /** Last scan result */
  lastResult: ScanResult | null
  /** Manually submit a barcode (manual entry / camera) */
  submitManual: (code: string) => void
  /** Enter EDITING mode (user is interacting with cart) */
  enterEditing: () => void
  /** Exit EDITING mode, return to IDLE */
  exitEditing: () => void
  /** Whether scanner is actively listening */
  isActive: boolean
}

interface Options {
  context: ScannerContext
  onResult: (result: ScanResult) => void
  canAddProducts?: boolean
  config?: Partial<ScannerConfig>
  enabled?: boolean
}

export function useBarcodeScanner({
  context,
  onResult,
  canAddProducts = false,
  config: configOverride,
  enabled = true,
}: Options): UseBarcodeScanner {
  const [state, setState] = useState<ScannerState>('IDLE')
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)

  const config = { ...DEFAULT_SCANNER_CONFIG, ...configOverride }
  const queueRef = useRef(new ScanQueue())
  const detectorRef = useRef<KeyboardScanDetector | null>(null)
  const editingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef<ScannerState>('IDLE')

  const transition = useCallback((to: ScannerState) => {
    assertTransition(stateRef.current, to)
    stateRef.current = to
    setState(to)
  }, [])

  const handleScanInput = useCallback(
    async (scan: ScanInput) => {
      if (stateRef.current === 'EDITING' || stateRef.current === 'PROCESSING') return

      transition('QUEUED')
      queueRef.current.enqueue(scan)
    },
    [transition]
  )

  // Wire queue processor
  useEffect(() => {
    const queue = queueRef.current
    queue.setProcessor(async (scan) => {
      transition('PROCESSING')
      try {
        const result = await processScan(scan, {
          onResult: (r) => {
            setLastResult(r)
            onResult(r)
          },
          getContext: () => context,
          canAddProducts,
        })

        transition(result.action === 'error' ? 'ERROR' : 'FEEDBACK')

        // Auto-return to IDLE after feedback window
        setTimeout(() => {
          if (stateRef.current === 'FEEDBACK' || stateRef.current === 'ERROR') {
            transition('IDLE')
          }
        }, config.interactionWindowMs)
      } catch {
        transition('ERROR')
        setTimeout(() => transition('IDLE'), config.interactionWindowMs)
      }
    })
  }, [context, canAddProducts, onResult, transition, config.interactionWindowMs])

  // Attach / detach keyboard detector
  useEffect(() => {
    if (!enabled) return

    const detector = new KeyboardScanDetector(config, {
      onScanDetected: handleScanInput,
      onStateChange: (s) => {
        if (s === 'DETECTING' && stateRef.current === 'IDLE') {
          transition('DETECTING')
        } else if (s === 'IDLE' && stateRef.current === 'DETECTING') {
          transition('IDLE')
        }
      },
    })

    detectorRef.current = detector
    detector.attach()

    return () => {
      detector.detach()
      detectorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  const submitManual = useCallback(
    (code: string) => {
      const trimmed = code.trim()
      if (!trimmed) return
      handleScanInput({ code: trimmed, source: 'manual', timestamp: Date.now() })
    },
    [handleScanInput]
  )

  const enterEditing = useCallback(() => {
    if (editingTimerRef.current) clearTimeout(editingTimerRef.current)
    if (stateRef.current !== 'PROCESSING') {
      transition('EDITING')
    }
  }, [transition])

  const exitEditing = useCallback(() => {
    if (editingTimerRef.current) clearTimeout(editingTimerRef.current)
    editingTimerRef.current = setTimeout(() => {
      if (stateRef.current === 'EDITING') transition('IDLE')
    }, 300)
  }, [transition])

  return {
    state,
    lastResult,
    submitManual,
    enterEditing,
    exitEditing,
    isActive: enabled && state !== 'EDITING',
  }
}
