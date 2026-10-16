import { NextRequest, NextResponse } from 'next/server'
import { getAdminModels } from '@/lib/admin-models'
import { getAuthPayload } from '@/lib/jwt'

// Returns tenant config including payment notification settings
export async function GET(request: NextRequest) {
  try {
    // Get tenant info from JWT token
    const payload = await getAuthPayload()
    if (!payload || !payload.mongoUri) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Look up tenant by mongoUri (since that's what's in the JWT)
    const { Tenant } = await getAdminModels()
    const tenant = await Tenant.findOne({ mongoUri: payload.mongoUri })
      .select('features paymentNotification')
      .lean()

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json({
      features: tenant.features || {},
      paymentNotification: tenant.paymentNotification || {
        enabled: false,
        paymentUrl: '',
        message: '',
        daysOverdue: 0,
      },
    })
  } catch (error) {
    console.error('Error fetching tenant config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
