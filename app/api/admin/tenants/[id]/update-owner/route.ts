import { NextRequest, NextResponse } from 'next/server'
import { getAdminModels } from '@/lib/admin-models'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import { verifyAdminSession } from '../../../auth/route'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifyAdminSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email, password, shopName } = await request.json()
  const { id } = await params

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  try {
    const { Tenant } = await getAdminModels()
    const tenant = await Tenant.findById(id).lean() as { mongoUri: string; shopName?: string } | null
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    console.log('[update-owner] Connecting to tenant DB:', tenant.mongoUri)
    const conn = await connectTenantDB(tenant.mongoUri)
    const { User } = getModels(conn)

    // Find existing owner
    let owner = await User.findOne({ role: 'admin' })
    console.log('[update-owner] Existing owner:', owner ? owner.email : 'none')

    if (owner) {
      // Update existing owner
      if (email && email !== owner.email) {
        const existing = await User.findOne({ email, _id: { $ne: owner._id } })
        if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
        owner.email = email
      }
      if (password) owner.password = password
      await owner.save()
      console.log('[update-owner] Updated existing owner')
    } else {
      // No owner yet — create one
      if (!password) return NextResponse.json({ error: 'Password is required to create owner account' }, { status: 400 })
      owner = new User({
        email,
        password,
        shopName: shopName || (tenant as any).shopName || 'My Shop',
        role: 'admin',
      })
      await owner.save()
      console.log('[update-owner] Created new owner')
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[update-owner POST] Full error:', error?.message, error)
    return NextResponse.json({ error: error?.message || 'Failed to update owner' }, { status: 500 })
  }
}
