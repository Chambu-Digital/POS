import { NextRequest, NextResponse } from 'next/server'
import { getAdminModels } from '@/lib/admin-models'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import bcryptjs from 'bcryptjs'

const RESET_API_KEY = process.env.RESET_API_KEY
const RESET_PROJECT_ID = process.env.RESET_PROJECT_ID
const RESET_API_BASE = process.env.RESET_API_BASE || 'https://reset.chambudigital.co.ke'

if (!RESET_API_KEY || !RESET_PROJECT_ID) {
  console.warn('[reset/verify-otp] ResetAPI credentials not configured')
}

export async function POST(request: NextRequest) {
  try {
    const { email, otp, password, confirmPassword } = await request.json()
    
    if (!email || !otp || !password || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
    }

    // Call ResetAPI to verify OTP only (we'll hash the password ourselves)
    const response = await fetch(`${RESET_API_BASE}/api/password-reset/verify-otp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESET_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        clientId: RESET_PROJECT_ID,
        otp,
        password,
        confirmPassword,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[reset/verify-otp] ResetAPI error:', data)
      return NextResponse.json({ error: data.error || 'Invalid OTP or expired' }, { status: response.status })
    }

    // Hash the password using bcrypt
    const salt = await bcryptjs.genSalt(10)
    const hashedPassword = await bcryptjs.hash(password, salt)

    // Update password in the correct tenant database
    const { Tenant } = await getAdminModels()
    const tenants = await Tenant.find({ isActive: true }).lean() as Array<{
      _id: any
      mongoUri: string
      features: Record<string, boolean>
      shopName: string
    }>
    
    let updated = false

    for (const tenant of tenants) {
      try {
        const conn = await connectTenantDB(tenant.mongoUri)
        const models = getModels(conn)
        
        // Try to update owner
        const user = await models.User.findOne({ email })
        if (user) {
          await models.User.updateOne({ _id: user._id }, { password: hashedPassword })
          updated = true
          break
        }
        
        // Try to update staff
        const staff = await models.Staff.findOne({ email, active: true })
        if (staff) {
          await models.Staff.updateOne({ _id: staff._id }, { password: hashedPassword })
          updated = true
          break
        }
      } catch (err) {
        console.error('[reset/verify-otp] Error updating tenant:', tenant.mongoUri, err)
        continue
      }
    }

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Password reset successfully' })
  } catch (error) {
    console.error('[reset/verify-otp] error:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
