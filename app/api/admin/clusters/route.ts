import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Cluster from '@/lib/models/Cluster'
import { verifyAdminSession } from '../auth/route'

export async function GET(request: NextRequest) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  const clusters = await Cluster.find().sort({ createdAt: 1 }).lean()
  return NextResponse.json({ clusters })
}

export async function POST(request: NextRequest) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()

  const { name, baseUri, maxTenants } = await request.json()
  if (!name || !baseUri) return NextResponse.json({ error: 'name and baseUri are required' }, { status: 400 })

  const cluster = new Cluster({ name, baseUri, maxTenants: maxTenants || 5 })
  await cluster.save()
  return NextResponse.json({ cluster }, { status: 201 })
}
