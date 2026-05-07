import { NextRequest, NextResponse } from 'next/server'
import { getAdminModels } from '@/lib/admin-models'
import { verifyAdminSession } from '../../auth/route'
import { normaliseFeatures } from '@/lib/modules'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { Tenant } = await getAdminModels()
  const tenant = await Tenant.findById(id).lean()
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ tenant })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { Tenant } = await getAdminModels()
  const data = await request.json()
  // Normalise feature keys if features are being updated
  if (data.features) data.features = normaliseFeatures(data.features)
  const tenant = await Tenant.findByIdAndUpdate(id, { $set: data }, { new: true })
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ tenant })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { Tenant } = await getAdminModels()
  await Tenant.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}
