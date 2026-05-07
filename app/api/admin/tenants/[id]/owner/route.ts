import { NextRequest, NextResponse } from 'next/server'
import { getAdminModels } from '@/lib/admin-models'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import { verifyAdminSession } from '../../../auth/route'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifyAdminSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    // Get tenant
    const { Tenant } = await getAdminModels()
    const tenant = await Tenant.findById(id).lean() as { mongoUri: string } | null
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    // Connect to tenant DB and get owner
    const conn = await connectTenantDB(tenant.mongoUri)
    const { User } = getModels(conn)
    const owner = await User.findOne({ role: 'admin' }).select('email').lean()

    if (!owner) {
      return NextResponse.json({ email: '' })
    }

    return NextResponse.json({ email: owner.email })
  } catch (error) {
    console.error('[admin/tenants/owner GET]', error)
    return NextResponse.json({ error: 'Failed to fetch owner' }, { status: 500 })
  }
}
