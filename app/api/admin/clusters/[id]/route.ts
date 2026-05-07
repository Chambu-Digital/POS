import { NextRequest, NextResponse } from 'next/server'
import { getAdminModels } from '@/lib/admin-models'
import { verifyAdminSession } from '../../auth/route'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { Cluster } = await getAdminModels()
  const data = await request.json()
  const cluster = await Cluster.findByIdAndUpdate(id, { $set: data }, { new: true })
  if (!cluster) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ cluster })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { Cluster } = await getAdminModels()
  await Cluster.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}
