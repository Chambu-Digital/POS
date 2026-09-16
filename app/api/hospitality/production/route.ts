import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { logProduction } from '@/lib/hospitality/production'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.production']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const { searchParams } = new URL(request.url)
    
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')

    const query: any = { tenantId }

    if (status) query.status = status
    
    if (startDate || endDate) {
      query.productionDate = {}
      if (startDate) query.productionDate.$gte = new Date(startDate)
      if (endDate) query.productionDate.$lte = new Date(endDate)
    }

    const productionLogs = await models.HospitalityProductionLog.find(query)
      .sort({ productionDate: -1 })
      .limit(limit)
      .lean()

    // Populate menu item names
    for (const log of productionLogs) {
      const menuItem = await models.HospitalityMenuItem.findOne({
        _id: log.producedItemId,
        tenantId
      }).select('name').lean()
      
      if (menuItem) {
        log.producedItemName = menuItem.name
      }
    }

    return NextResponse.json({ productionLogs })
  } catch (error) {
    console.error('[hospitality/production GET]', error)
    return NextResponse.json({ error: 'Failed to fetch production logs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, conn, features } = await getTenantDB(request)
    if (!features['hospitality.production']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const producedBy = payload.type === 'staff' ? payload.userId : payload.userId
    const body = await request.json()

    if (!body.producedItemId || !body.expectedYield || !body.actualYield) {
      return NextResponse.json({ 
        error: 'producedItemId, expectedYield, and actualYield are required' 
      }, { status: 400 })
    }

    const session = await conn.startSession()

    try {
      let result
      await session.withTransaction(async () => {
        result = await logProduction(
          {
            producedItemId: body.producedItemId,
            servingTypeId: body.servingTypeId,
            expectedYield: body.expectedYield,
            actualYield: body.actualYield,
            ingredientsUsed: body.ingredientsUsed || [],
            notes: body.notes || '',
            producedBy
          },
          models,
          tenantId,
          session
        )
      })

      await session.endSession()

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ 
        success: true,
        productionLog: result.productionLog,
        requiresApproval: result.requiresApproval
      }, { status: 201 })
    } catch (error: any) {
      await session.endSession()
      throw error
    }
  } catch (error) {
    console.error('[hospitality/production POST]', error)
    return NextResponse.json({ error: 'Failed to log production' }, { status: 500 })
  }
}
