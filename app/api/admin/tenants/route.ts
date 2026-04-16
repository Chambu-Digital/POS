import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Tenant from '@/lib/models/Tenant'
import Cluster from '@/lib/models/Cluster'
import { verifyAdminSession } from '../auth/route'

export async function GET(request: NextRequest) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  const tenants = await Tenant.find().sort({ createdAt: -1 }).lean()
  return NextResponse.json({ tenants })
}

export async function POST(request: NextRequest) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()

  const { subdomain, clusterId, shopName, features } = await request.json()
  if (!subdomain || !clusterId) return NextResponse.json({ error: 'subdomain and clusterId are required' }, { status: 400 })

  const existing = await Tenant.findOne({ subdomain })
  if (existing) return NextResponse.json({ error: 'Subdomain already taken' }, { status: 409 })

  const cluster = await Cluster.findById(clusterId)
  if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
  if (!cluster.isActive) return NextResponse.json({ error: 'Cluster is inactive' }, { status: 400 })
  if (cluster.tenantCount >= cluster.maxTenants) {
    return NextResponse.json({ error: `Cluster is full (${cluster.tenantCount}/${cluster.maxTenants})` }, { status: 400 })
  }

  // Build the MongoDB URI: baseUri + "/" + subdomain
  const mongoUri = `${cluster.baseUri}/${subdomain}`

  const tenant = new Tenant({ subdomain, mongoUri, shopName, features, isActive: true })
  await tenant.save()

  // Increment cluster tenant count
  cluster.tenantCount += 1
  await cluster.save()

  return NextResponse.json({ tenant }, { status: 201 })
}
