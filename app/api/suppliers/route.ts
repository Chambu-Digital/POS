// ─── /api/suppliers ────────────────────────────────────────────────────────────
// Supplier CRUD endpoints for retail inventory management

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

// ── GET /api/suppliers ─────────────────────────────────────────────────────────
// List all suppliers for the tenant
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const activeOnly = searchParams.get('active') !== 'false' // default to active only

    const query: any = { userId: ownerId }
    if (activeOnly) query.isActive = true
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ]
    }

    const suppliers = await models.Supplier.find(query)
      .sort({ name: 1 })
      .lean()

    return NextResponse.json({ suppliers })
  } catch (error) {
    console.error('[suppliers] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
  }
}

// ── POST /api/suppliers ────────────────────────────────────────────────────────
// Create a new supplier
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const body = await request.json()

    // Validate required fields
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })
    }

    // Check for duplicate name
    const existing = await models.Supplier.findOne({
      userId: ownerId,
      name: { $regex: `^${body.name.trim()}$`, $options: 'i' },
      isActive: true,
    })
    if (existing) {
      return NextResponse.json({ error: 'Supplier with this name already exists' }, { status: 400 })
    }

    const supplier = new models.Supplier({
      userId: ownerId,
      name: body.name.trim(),
      contactPerson: body.contactPerson?.trim() || '',
      phone: body.phone?.trim() || '',
      email: body.email?.trim() || '',
      address: body.address?.trim() || '',
      notes: body.notes?.trim() || '',
      isActive: true,
    })

    await supplier.save()

    return NextResponse.json({ supplier }, { status: 201 })
  } catch (error) {
    console.error('[suppliers] POST error:', error)
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 })
  }
}
