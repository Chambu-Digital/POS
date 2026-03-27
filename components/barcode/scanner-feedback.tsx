'use client'

// ─── ScannerFeedback ───────────────────────────────────────────────────────────
// Visual + audio feedback for scan results

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { ScanResult, ScannerState } from '@/lib/barcode-scanner/types'

interface Props {
  state: ScannerState
  lastResult: ScanResult | null
}

// Tiny inline audio beeps via Web Audio API — no external files needed
function playBeep(type: 'success' | 'error') {
  if (typeof window === 'undefined') return
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.value = type === 'success' ? 1800 : 400
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    // Audio not available — silent fallback
  }
}

export function ScannerFeedback({ state, lastResult }: Props) {
  const prevResultRef = useRef<ScanResult | null>(null)

  useEffect(() => {
    if (!lastResult || lastResult === prevResultRef.current) return
    prevResultRef.current = lastResult

    if (lastResult.action === 'not_found' || lastResult.action === 'error') {
      playBeep('error')
    } else {
      playBeep('success')
    }
  }, [lastResult])

  if (state === 'IDLE' || state === 'EDITING') return null

  return (
    <div
      aria-live="polite"
      className={cn(
        'fixed bottom-4 right-4 z-50 rounded-lg px-4 py-2 text-sm font-medium shadow-lg transition-all',
        state === 'DETECTING' && 'bg-yellow-100 text-yellow-800 border border-yellow-300',
        state === 'PROCESSING' && 'bg-blue-100 text-blue-800 border border-blue-300',
        state === 'FEEDBACK' && lastResult?.action !== 'not_found' && 'bg-green-100 text-green-800 border border-green-300',
        (state === 'ERROR' || (state === 'FEEDBACK' && lastResult?.action === 'not_found')) &&
          'bg-red-100 text-red-800 border border-red-300',
      )}
    >
      {state === 'DETECTING' && '📡 Scanning...'}
      {state === 'PROCESSING' && '⏳ Looking up...'}
      {state === 'FEEDBACK' && lastResult?.action === 'added' && `✅ Added: ${lastResult.product?.productName}`}
      {state === 'FEEDBACK' && lastResult?.action === 'incremented' && `➕ Qty +1: ${lastResult.product?.productName}`}
      {state === 'FEEDBACK' && lastResult?.action === 'not_found' && `❌ ${lastResult.message}`}
      {state === 'ERROR' && `⚠️ ${lastResult?.message ?? 'Scan error'}`}
    </div>
  )
}
