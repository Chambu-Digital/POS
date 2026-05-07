import { NextRequest, NextResponse } from 'next/server'
import { getAdminModels } from '@/lib/admin-models'
import { verifyAdminSession } from '../auth/route'

export async function GET(request: NextRequest) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { Cluster } = await getAdminModels()
    const clusters = await Cluster.find().sort({ createdAt: 1 }).lean()
    return NextResponse.json({ clusters })
  } catch (err) {
    console.error('[admin/clusters GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { Cluster } = await getAdminModels()

    const { name, baseUri, maxTenants } = await request.json()
    if (!name || !baseUri) return NextResponse.json({ error: 'name and baseUri are required' }, { status: 400 })

    const cluster = new Cluster({ name, baseUri, maxTenants: maxTenants || 5 })
    await cluster.save()
    return NextResponse.json({ cluster }, { status: 201 })
  } catch (err) {
    console.error('[admin/clusters POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
