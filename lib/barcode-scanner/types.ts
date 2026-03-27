// ─── Barcode Scanner System — Types ───────────────────────────────────────────

export type ScanSource = 'scanner' | 'camera' | 'manual'

export interface ScanInput {
  code: string
  source: ScanSource
  timestamp: number
}

export type ScannerState =
  | 'IDLE'
  | 'DETECTING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'FEEDBACK'
  | 'EDITING'
  | 'ERROR'

export type ScannerContext = 'sales' | 'inventory' | 'none'

export interface ScanResult {
  input: ScanInput
  product: any | null
  action: 'added' | 'incremented' | 'not_found' | 'error'
  message?: string
}

export interface ScannerConfig {
  /** Min chars to consider a scan valid */
  minLength: number
  /** Max ms between keystrokes to be considered scanner input */
  keystrokeThreshold: number
  /** Min keystrokes per burst to detect scanner */
  minBurstLength: number
  /** Whether scanner expects Enter suffix */
  expectEnterSuffix: boolean
  /** Optional prefix to strip */
  prefix?: string
  /** Optional suffix to strip */
  suffix?: string
  /** Interaction window in ms before returning to IDLE */
  interactionWindowMs: number
}

export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  minLength: 3,
  keystrokeThreshold: 80,
  minBurstLength: 4,
  expectEnterSuffix: true,
  interactionWindowMs: 800,
}
