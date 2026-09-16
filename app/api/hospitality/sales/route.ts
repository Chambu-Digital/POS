import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { consumeServings } from '@/lib/hospitality/inventory'
import { canSatisfyOrder } from '@/lib/hospitality/calculator'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.orders']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    const query: any = { tenantId }

    if (status) query.status = status
    
    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) query.createdAt.$gte = new Date(startDate)
      if (endDate) query.createdAt.$lte = new Date(endDate)
    }

    const orders = await models.HospitalityOrder.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('[hospitality/sales GET]', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, conn, features } = await getTenantDB(request)
    if (!features['hospitality.pos']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const servedBy = payload.type === 'staff' ? payload.userId : payload.userId
    const body = await request.json()

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 })
    }

    if (!body.paymentMethod) {
      return NextResponse.json({ error: 'paymentMethod is required' }, { status: 400 })
    }

    const session = await conn.startSession()

    try {
      let order
      await session.withTransaction(async () => {
        // Generate order number
        const orderCount = await models.HospitalityOrder.countDocuments({ tenantId })
        const orderNumber = `HSP-${Date.now()}-${orderCount + 1}`

        // Validate and deduct inventory for tracked items
        for (const item of body.items) {
          const menuItem = await models.HospitalityMenuItem.findOne({
            _id: new Types.ObjectId(item.menuItemId),
            tenantId
          }).session(session)

          if (!menuItem) {
            throw new Error(`Menu item ${item.menuItemId} not found`)
          }

          // Only deduct inventory for tracked items
          if (menuItem.inventoryMode === 'tracked') {
            // For servable items, deduct servings
            if (menuItem.isServable && item.servingTypeId) {
              const result = await consumeServings(
                {
                  menuItemId: item.menuItemId,
                  servingTypeId: item.servingTypeId,
                  quantity: item.servingsOrdered || item.quantity,
                  referenceType: 'sale',
                  performedBy: servedBy
                },
                models,
                tenantId,
                session
              )

              if (!result.success) {
                throw new Error(`Insufficient stock for ${menuItem.name}: ${result.error}`)
              }
            } else {
              // For whole-only items, deduct whole units
              const inventory = await models.HospitalityServingInventory.findOne({
                tenantId,
                menuItemId: item.menuItemId
              }).session(session)

              if (!inventory || inventory.wholeUnits < item.quantity) {
                throw new Error(`Insufficient stock for ${menuItem.name}`)
              }

              inventory.wholeUnits -= item.quantity
              await inventory.save({ session })

              // Create movement record
              await models.HospitalityServingMovement.create([{
                tenantId,
                menuItemId: item.menuItemId,
                movementType: 'sale',
                quantity: item.quantity,
                wholeUnitsChanged: -item.quantity,
                beforeState: {
                  wholeUnits: inventory.wholeUnits + item.quantity,
                  partialUnits: 0,
                  totalServings: {}
                },
                afterState: {
                  wholeUnits: inventory.wholeUnits,
                  partialUnits: 0,
                  totalServings: {}
                },
                reason: 'Sold to customer',
                referenceType: 'sale',
                performedBy: servedBy
              }], { session })
            }
          }
          // Untracked items don't need inventory deduction
        }

        // Create order
        order = await models.HospitalityOrder.create([{
          tenantId,
          orderNumber,
          items: body.items.map((item: any) => ({
            menuItemId: item.menuItemId,
            name: item.name,
            quantity: item.quantity,
            servingTypeId: item.servingTypeId || null,
            servingTypeName: item.servingTypeName || '',
            servingsOrdered: item.servingsOrdered || null,
            pricePerUnit: item.pricePerUnit,
            totalPrice: item.totalPrice
          })),
          subtotal: body.subtotal,
          tax: body.tax || 0,
          total: body.total,
          paymentMethod: body.paymentMethod,
          paymentStatus: 'paid',
          customerId: body.customerId || null,
          servedBy,
          tableNumber: body.tableNumber || '',
          orderType: body.orderType || 'dine-in',
          status: 'completed',
          completedAt: new Date()
        }], { session })
      })

      await session.endSession()

      return NextResponse.json({ 
        success: true,
        order: order[0]
      }, { status: 201 })
    } catch (error: any) {
      await session.endSession()
      console.error('[hospitality/sales POST] Transaction error:', error)
      return NextResponse.json({ error: error.message || 'Failed to create sale' }, { status: 400 })
    }
  } catch (error) {
    console.error('[hospitality/sales POST]', error)
    return NextResponse.json({ error: 'Failed to create sale' }, { status: 500 })
  }
}
