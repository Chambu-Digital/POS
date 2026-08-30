// ─── /api/suppliers/[id] ───────────────────────────────────────────────────────
// Single supplier operations: get, update, delete

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// ── GET /api/suppliers/[id] ────────────────────────────────────────────────────
// Get supplier details with purchase history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const supplier = await models.Supplier.findOne({
      _id: params.id,
      userId: ownerId,
    }).lean()

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Get purchase history from StockLedger
    const purchaseHistory = await (models as any).StockLedger.find({
      userId: ownerId,
      supplierId: new Types.ObjectId(params.id),
      type: 'STOCK_IN',
    })
      .sort({ timestamp: -1 })
      .limit(100)
      .populate('productId', 'productName')
      .lean()

    // Calculate stats
    const totalPurchases = purchaseHistory.length
    const totalValue = purchaseHistory.reduce((sum: number, h: any) => sum + (h.totalCost || 0), 0)
    
    // Get unique products supplied
    const productIds = new Set(purchaseHistory.map((h: any) => h.productId?._id?.toString()).filter(Boolean))
    const productsSupplied = productIds.size

    return NextResponse.json({
      supplier,
      purchaseHistory,
      stats: {
        totalPurchases,
        totalValue,
        productsSupplied,
      },
    })
  } catch (error) {
    console.error('[suppliers/id] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch supplier' }, { status: 500 })
  }
}

// ── PUT /api/suppliers/[id] ────────────────────────────────────────────────────
// Update supplier information
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check for duplicate name (excluding current supplier)
    const existing = await models.Supplier.findOne({
      userId: ownerId,
      name: { $regex: `^${body.name.trim()}$`, $options: 'i' },
      isActive: true,
      _id: { $ne: params.id },
    })
    if (existing) {
      return NextResponse.json({ error: 'Supplier with this name already exists' }, { status: 400 })
    }

    const supplier = await models.Supplier.findOneAndUpdate(
      { _id: params.id, userId: ownerId },
      {
        name: body.name.trim(),
        contactPerson: body.contactPerson?.trim() || '',
        phone: body.phone?.trim() || '',
        email: body.email?.trim() || '',
        address: body.address?.trim() || '',
        notes: body.notes?.trim() || '',
        updatedAt: new Date(),
      },
      { new: true }
    )

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    return NextResponse.json({ supplier })
  } catch (error) {
    console.error('[suppliers/id] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 })
  }
}

// ── DELETE /api/suppliers/[id] ─────────────────────────────────────────────────
// Soft delete supplier (set isActive = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const supplier = await models.Supplier.findOneAndUpdate(
      { _id: params.id, userId: ownerId },
      {
        isActive: false,
        updatedAt: new Date(),
      },
      { new: true }
    )

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, supplier })
  } catch (error) {
    console.error('[suppliers/id] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 })
  }
}
