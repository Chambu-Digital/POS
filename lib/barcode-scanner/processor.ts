// ─── Barcode Scanner — Processing Engine ──────────────────────────────────────

import type { ScanInput, ScanResult, ScannerContext } from './types'
import { getProductByBarcode, isOnline } from '@/lib/indexeddb'

export interface ProcessorCallbacks {
  onResult: (result: ScanResult) => void
  getContext: () => ScannerContext
  canAddProducts: boolean
}

export async function processScan(
  scan: ScanInput,
  callbacks: ProcessorCallbacks
): Promise<ScanResult> {
  const { code } = scan

  // Step 1: Local cache lookup (offline-first)
  let product = await getProductByBarcode(code)

  // Step 2: API fallback if online and not found locally
  if (!product && isOnline()) {
    try {
      const res = await fetch(`/api/products/barcode/${encodeURIComponent(code)}`)
      if (res.ok) {
        const data = await res.json()
        product = data.product ?? null
      }
    } catch {
      // network error — proceed with null product
    }
  }

  let result: ScanResult

  if (product) {
    result = {
      input: scan,
      product,
      action: 'added', // caller will determine added vs incremented
    }
  } else {
    result = {
      input: scan,
      product: null,
      action: 'not_found',
      message: `No product found for barcode: ${code}`,
    }
  }

  callbacks.onResult(result)
  return result
}
