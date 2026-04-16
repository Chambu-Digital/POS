import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Cluster from '@/lib/models/Cluster'
import { verifyAdminSession } from '../../auth/route'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  const data = await request.json()
  const cluster = await Cluster.findByIdAndUpdate(params.id, { $set: data }, { new: true })
  if (!cluster) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ cluster })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  await Cluster.findByIdAndDelete(params.id)
  return NextResponse.json({ ok: true })
}
