import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_MODULE_FEATURES, normaliseFeatures } from '@/lib/modules'
import { getAuthPayload } from '@/lib/jwt'

// Returns tenant feature flags from the JWT token.
// Falls back to DEFAULT_MODULE_FEATURES when unauthenticated (sidebar on login page).
export async function GET(_request: NextRequest) {
  const payload = await getAuthPayload()
  const features = payload?.tenantFeatures
    ? normaliseFeatures(payload.tenantFeatures)
    : DEFAULT_MODULE_FEATURES
  return NextResponse.json({ features })
}
