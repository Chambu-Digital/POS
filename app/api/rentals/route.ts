import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    await models.Rental.updateMany(
      { userId: ownerId, status: 'active', startTime: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      { $set: { status: 'overdue' } }
    )

    const rentals = await models.Rental.find({ userId: ownerId }).sort({ createdAt: -1 })
    return NextResponse.json({ rentals })
  } catch (error) {
    console.error('[Rentals] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch rentals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    // Validate stock for all items
    for (const item of data.items) {
      if (!item.productId || item.productId.toString().startsWith('demo_')) continue
      
      const productId = new Types.ObjectId(item.productId)
      let availableStock = 0

      if (branchContext) {
        // Multi-branch: check ProductInventory
        const inventory = await models.ProductInventory.findOne({
          userId: ownerId,
          branchId: branchContext,
          productId,
        })
        availableStock = inventory?.stock || 0
      } else {
        // Legacy: check Product.stock
        const product = await models.Product.findById(productId)
        availableStock = product?.stock || 0
      }

      if (availableStock < item.quantity) {
        return NextResponse.json({ 
          error: `Insufficient stock for ${item.productName}. Available: ${availableStock}` 
        }, { status: 400 })
      }
    }

    // Deduct stock for all items
    for (const item of data.items) {
      if (!item.productId || item.productId.toString().startsWith('demo_')) continue
      
      const productId = new Types.ObjectId(item.productId)

      if (branchContext) {
        // Multi-branch: update ProductInventory
        const inventory = await models.ProductInventory.findOne({
          userId: ownerId,
          branchId: branchContext,
          productId,
        })

        if (inventory) {
          inventory.stock -= item.quantity
          inventory.lastUpdated = new Date()
          await inventory.save()
        }

        // Also update Product.stock for backward compatibility
        await models.Product.findByIdAndUpdate(
          productId,
          { $inc: { stock: -item.quantity }, updatedAt: new Date() }
        )
      } else {
        // Legacy: update Product.stock only
        await models.Product.findByIdAndUpdate(
          productId,
          { $inc: { stock: -item.quantity } }
        )
      }
    }

    const rental = new models.Rental({
      customer: data.customer, items: data.items,
      startTime: data.startTime || new Date(),
      deposit: data.deposit || 0, depositPaymentMethod: data.depositPaymentMethod || '',
      status: 'active', userId: ownerId,
      staffId: payload.type === 'staff' ? payload.userId : null,
      notes: data.notes,
    })
    await rental.save()
    return NextResponse.json({ rental }, { status: 201 })
  } catch (error) {
    console.error('[Rentals] POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create rental' }, { status: 500 })
  }
}
