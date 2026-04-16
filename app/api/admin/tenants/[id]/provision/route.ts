import { NextRequest, NextResponse } from 'next/server'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import Tenant from '@/lib/models/Tenant'
import { connectDB } from '@/lib/db'
import { verifyAdminSession } from '../../../auth/route'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await verifyAdminSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email, password, shopName } = await request.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
  }

  // Load tenant to get their mongoUri
  await connectDB()
  const tenant = await Tenant.findById(params.id).lean() as { mongoUri: string; shopName?: string } | null
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // Connect to the tenant's own DB and create the owner account
  const conn = await connectTenantDB(tenant.mongoUri)
  const { User } = getModels(conn)

  const existing = await User.findOne({ email })
  if (existing) return NextResponse.json({ error: 'An account with this email already exists in this tenant' }, { status: 409 })

  const user = new User({
    email,
    password,
    shopName: shopName || tenant.shopName || 'My Shop',
    role: 'admin',
  })
  await user.save()

  return NextResponse.json({ ok: true, userId: user._id })
}
