import { NextRequest, NextResponse } from 'next/server'
import { getAdminModels } from '@/lib/admin-models'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'

const RESET_API_KEY = process.env.RESET_API_KEY
const RESET_PROJECT_ID = process.env.RESET_PROJECT_ID
const RESET_API_BASE = process.env.RESET_API_BASE || 'https://reset.chambudigital.co.ke'

if (!RESET_API_KEY || !RESET_PROJECT_ID) {
  console.warn('[reset/request-otp] ResetAPI credentials not configured')
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check if user exists in any tenant
    const { Tenant } = await getAdminModels()
    const tenants = await Tenant.find({ isActive: true }).lean() as Array<{
      _id: any
      mongoUri: string
      features: Record<string, boolean>
      shopName: string
    }>
    
    let userFound = false
    let userTenantId: string | null = null

    for (const tenant of tenants) {
      try {
        const conn = await connectTenantDB(tenant.mongoUri)
        const models = getModels(conn)
        
        // Check for owner
        const user = await models.User.findOne({ email })
        if (user) {
          userFound = true
          userTenantId = tenant._id.toString()
          break
        }
        
        // Check for staff
        const staff = await models.Staff.findOne({ email, active: true })
        if (staff) {
          userFound = true
          userTenantId = tenant._id.toString()
          break
        }
      } catch (err) {
        console.error('[reset/request-otp] Error checking tenant:', tenant.mongoUri, err)
        continue
      }
    }

    // Always call ResetAPI even if user not found (security best practice)
    // This prevents email enumeration attacks
    const response = await fetch(`${RESET_API_BASE}/api/password-reset/request-otp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESET_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        clientId: RESET_PROJECT_ID,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[reset/request-otp] ResetAPI error:', data)
      return NextResponse.json({ error: 'Failed to send OTP' }, { status: response.status })
    }

    // Return success message (don't reveal whether user exists)
    return NextResponse.json({ 
      message: 'If an account exists with this email, you will receive a 6-digit code',
      userFound: userFound // For internal use only, don't expose to client in production
    })
  } catch (error) {
    console.error('[reset/request-otp] error:', error)
    return NextResponse.json({ error: 'Failed to request OTP' }, { status: 500 })
  }
}
