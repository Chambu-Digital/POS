import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/bank-providers - List all bank providers for the tenant
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const providers = await models.BankProvider.find({ 
      userId: ownerId,
      isActive: true 
    })
      .sort({ name: 1 })
      .lean()

    return NextResponse.json({ providers })
  } catch (error) {
    console.error('[bank-providers] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch bank providers' }, { status: 500 })
  }
}

// POST /api/bank-providers - Create a new bank provider
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: 'Bank name is required' }, { status: 400 })
    }

    // Check if bank provider already exists
    const existing = await models.BankProvider.findOne({
      userId: ownerId,
      name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') } // case-insensitive
    })

    if (existing) {
      return NextResponse.json({ 
        error: 'Bank provider already exists',
        provider: existing 
      }, { status: 409 })
    }

    const provider = new models.BankProvider({
      userId: ownerId,
      name: data.name.trim(),
      isActive: true,
    })

    await provider.save()

    return NextResponse.json({ provider }, { status: 201 })
  } catch (error: any) {
    console.error('[bank-providers] POST error:', error)
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json({ error: 'Bank provider already exists' }, { status: 409 })
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to create bank provider' 
    }, { status: 500 })
  }
}
