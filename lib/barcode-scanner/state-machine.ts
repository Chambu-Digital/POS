// ─── Barcode Scanner — State Machine ──────────────────────────────────────────

import type { ScannerState } from './types'

type Transition = {
  from: ScannerState | ScannerState[]
  to: ScannerState
}

const TRANSITIONS: Transition[] = [
  { from: 'IDLE',       to: 'DETECTING'  },
  { from: 'DETECTING',  to: 'IDLE'       }, // burst too slow / cancelled
  { from: 'DETECTING',  to: 'QUEUED'     },
  { from: 'QUEUED',     to: 'PROCESSING' },
  { from: 'PROCESSING', to: 'FEEDBACK'   },
  { from: 'PROCESSING', to: 'ERROR'      },
  { from: 'FEEDBACK',   to: 'IDLE'       },
  { from: 'ERROR',      to: 'IDLE'       },
  // EDITING can be entered from any non-processing state
  { from: ['IDLE', 'FEEDBACK', 'ERROR', 'DETECTING'], to: 'EDITING' },
  { from: 'EDITING',    to: 'IDLE'       },
]

export function canTransition(from: ScannerState, to: ScannerState): boolean {
  return TRANSITIONS.some((t) => {
    const froms = Array.isArray(t.from) ? t.from : [t.from]
    return froms.includes(from) && t.to === to
  })
}

export function assertTransition(from: ScannerState, to: ScannerState): void {
  if (!canTransition(from, to)) {
    console.warn(`[Scanner] Invalid transition: ${from} → ${to}`)
  }
}
