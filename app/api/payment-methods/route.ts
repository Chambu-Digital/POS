import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/payment-methods - List all custom payment methods for the tenant
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const methods = await models.PaymentMethod.find({ 
      userId: ownerId
    })
      .sort({ name: 1 })
      .lean()

    return NextResponse.json({ methods })
  } catch (error) {
    console.error('[payment-methods] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch payment methods' }, { status: 500 })
  }
}

// POST /api/payment-methods - Create a new custom payment method
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: 'Payment method name is required' }, { status: 400 })
    }

    // Check if payment method already exists (case-insensitive)
    const existing = await models.PaymentMethod.findOne({
      userId: ownerId,
      name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') }
    })

    if (existing) {
      // If exists but inactive, reactivate it
      if (!existing.isActive) {
        existing.isActive = true
        await existing.save()
        return NextResponse.json({ 
          method: existing,
          message: 'Payment method reactivated' 
        }, { status: 200 })
      }
      
      // If exists and active, return conflict
      return NextResponse.json({ 
        error: 'Payment method already exists',
        method: existing 
      }, { status: 409 })
    }

    const method = new models.PaymentMethod({
      userId: ownerId,
      name: data.name.trim(),
      type: data.type || 'other',
      isActive: true,
    })

    await method.save()

    return NextResponse.json({ method }, { status: 201 })
  } catch (error: any) {
    console.error('[payment-methods] POST error:', error)
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json({ error: 'Payment method already exists' }, { status: 409 })
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to create payment method' 
    }, { status: 500 })
  }
}

// DELETE /api/payment-methods?id=xxx - Delete a custom payment method
export async function DELETE(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const methodId = searchParams.get('id')

    if (!methodId) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Find and delete the payment method (ensure it belongs to the user)
    const method = await models.PaymentMethod.findOneAndDelete({
      _id: methodId,
      userId: ownerId
    })

    if (!method) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Payment method deleted' 
    })
  } catch (error: any) {
    console.error('[payment-methods] DELETE error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to delete payment method' 
    }, { status: 500 })
  }
}
