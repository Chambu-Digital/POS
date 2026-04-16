import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_FEATURES } from '@/lib/features'

// Returns tenant feature flags from the middleware header.
// Falls back to DEFAULT_FEATURES on localhost (no tenant header).
export async function GET(request: NextRequest) {
  const raw = request.headers.get('x-tenant-features')
  const features = raw ? JSON.parse(raw) : DEFAULT_FEATURES
  return NextResponse.json({ features })
}
