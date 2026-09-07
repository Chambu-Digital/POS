import { NextRequest, NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/jwt'
import { normaliseFeatures } from '@/lib/modules'
import { getAvailableReportTypes } from '@/lib/report-types'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get features from JWT token (same source as sidebar)
    const enabledFeatures = normaliseFeatures(payload.tenantFeatures || {})
    const availableTypes = getAvailableReportTypes(enabledFeatures)

    return NextResponse.json({ reportTypes: availableTypes })
  } catch (error) {
    console.error('Error fetching report types:', error)
    return NextResponse.json({ error: 'Failed to fetch report types' }, { status: 500 })
  }
}
