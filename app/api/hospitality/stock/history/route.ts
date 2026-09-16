import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.stock']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const { searchParams } = new URL(request.url)
    
    const menuItemId = searchParams.get('menuItemId')
    const movementType = searchParams.get('movementType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const query: any = { tenantId }

    if (menuItemId) {
      query.menuItemId = new Types.ObjectId(menuItemId)
    }

    if (movementType) {
      query.movementType = movementType
    }

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = new Date(startDate)
      if (endDate) query.timestamp.$lte = new Date(endDate)
    }

    const movements = await models.HospitalityServingMovement.find(query)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .lean()

    // Populate menu item names
    for (const movement of movements) {
      const menuItem = await models.HospitalityMenuItem.findOne({
        _id: movement.menuItemId,
        tenantId
      }).select('name').lean()
      
      if (menuItem) {
        movement.menuItemName = menuItem.name
      }

      // Populate serving type name if applicable
      if (movement.servingTypeId) {
        const servingType = await models.HospitalityServingType.findOne({
          _id: movement.servingTypeId,
          tenantId
        }).select('name').lean()
        
        if (servingType) {
          movement.servingTypeName = servingType.name
        }
      }
    }

    const total = await models.HospitalityServingMovement.countDocuments(query)

    return NextResponse.json({
      movements,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + movements.length < total
      }
    })
  } catch (error) {
    console.error('[hospitality/stock/history GET]', error)
    return NextResponse.json({ error: 'Failed to fetch stock history' }, { status: 500 })
  }
}
