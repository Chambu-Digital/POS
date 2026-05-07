import { NextRequest, NextResponse } from 'next/server'
import { getAdminModels } from '@/lib/admin-models'
import { verifyAdminSession } from '../auth/route'
import { normaliseFeatures, DEFAULT_MODULE_FEATURES } from '@/lib/modules'

export async function GET(request: NextRequest) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { Tenant } = await getAdminModels()
    const tenants = await Tenant.find().sort({ createdAt: -1 }).lean()
    return NextResponse.json({ tenants })
  } catch (err) {
    console.error('[admin/tenants GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!await verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const { subdomain: rawSubdomain, clusterId, shopName, features } = await request.json()

  // Accept explicit subdomain or derive from shop name
  const subdomain = (rawSubdomain || shopName || '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30)

  if (!subdomain || !clusterId) return NextResponse.json({ error: 'shopName and clusterId are required' }, { status: 400 })

  const { Tenant, Cluster } = await getAdminModels()

  const existing = await Tenant.findOne({ subdomain })
  if (existing) return NextResponse.json({ error: 'Subdomain already taken' }, { status: 409 })

  const cluster = await Cluster.findById(clusterId)
  if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
  if (!cluster.isActive) return NextResponse.json({ error: 'Cluster is inactive' }, { status: 400 })
  if (cluster.tenantCount >= cluster.maxTenants) {
    return NextResponse.json({ error: `Cluster is full (${cluster.tenantCount}/${cluster.maxTenants})` }, { status: 400 })
  }

  // Build the MongoDB URI: insert database name before query string
  // e.g. mongodb://user:pass@host:27017/?ssl=true  →  mongodb://user:pass@host:27017/test1?ssl=true
  const uriParts = cluster.baseUri.split('?')
  const mongoUri = uriParts.length > 1
    ? `${uriParts[0].replace(/\/$/, '')}/${subdomain}?${uriParts[1]}`
    : `${cluster.baseUri.replace(/\/$/, '')}/${subdomain}`

  const normalisedFeatures = normaliseFeatures(features || DEFAULT_MODULE_FEATURES)
  const tenant = new Tenant({ subdomain, mongoUri, shopName, features: normalisedFeatures, isActive: true })
  await tenant.save()

  // Increment cluster tenant count
  cluster.tenantCount += 1
  await cluster.save()

  return NextResponse.json({ tenant }, { status: 201 })
}
