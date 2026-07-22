import { NextRequest, NextResponse } from 'next/server'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import { getAdminModels } from '@/lib/admin-models'
import { verifyAdminSession } from '../../../auth/route'
import { checkEmailExistsAcrossTenants } from '@/lib/auth/check-email-exists'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifyAdminSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { email, password, shopName } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }

    const { id } = await params

    const { Tenant } = await getAdminModels()
    const tenant = await Tenant.findById(id).lean() as { mongoUri: string; shopName?: string } | null
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    // Check if email already exists across all tenants
    const existingAccount = await checkEmailExistsAcrossTenants(email)
    if (existingAccount) {
      return NextResponse.json({ 
        error: 'An account with this email already exists in another tenant. Please use a different email.' 
      }, { status: 409 })
    }

    console.log('[provision] Connecting to tenant DB:', tenant.mongoUri)
    const conn = await connectTenantDB(tenant.mongoUri)
    const { User } = getModels(conn)

    const user = new User({
      email,
      password,
      shopName: shopName || (tenant as any).shopName || 'My Shop',
      role: 'admin',
    })
    await user.save()

    return NextResponse.json({ ok: true, userId: user._id })
  } catch (error: any) {
    console.error('[provision POST]', error?.message, error)
    return NextResponse.json({ error: error?.message || 'Failed to provision tenant' }, { status: 500 })
  }
}
