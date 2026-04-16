import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Tenant from '@/lib/models/Tenant'
import { verifyAdminSession } from '../../auth/route'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  const tenant = await Tenant.findById(params.id).lean()
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ tenant })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  const data = await request.json()
  const tenant = await Tenant.findByIdAndUpdate(params.id, { $set: data }, { new: true })
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ tenant })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  await Tenant.findByIdAndDelete(params.id)
  return NextResponse.json({ ok: true })
}
