// ─── GET /api/inventory/stock-ledger/summary ─────────────────────────────────
// Returns an aggregated summary of stock movements grouped by product + type.
// Used by the stock movements report page.
//
// Query params:
//   startDate  (required) — ISO date string e.g. 2024-10-22
//   endDate    (required) — ISO date string e.g. 2024-10-22  (same day = single day)
//   staffId    (optional) — ObjectId of a staff member; "owner" = movements with no staffId
//   type       (optional) — filter to a specific movement type

import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId       = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)
    const { searchParams } = new URL(request.url)

    const startDateStr = searchParams.get('startDate')
    const endDateStr   = searchParams.get('endDate')
    const staffIdParam = searchParams.get('staffId')   // ObjectId string, or "owner"
    const typeParam    = searchParams.get('type')

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    // Build the date range covering the full end day
    const startDate = new Date(startDateStr)
    const endDate   = new Date(endDateStr)
    endDate.setHours(23, 59, 59, 999)

    // ── Match stage ───────────────────────────────────────────────────────────
    const match: any = {
      userId:    new Types.ObjectId(ownerId),
      timestamp: { $gte: startDate, $lte: endDate },
    }

    if (branchContext) match.branchId = new Types.ObjectId(branchContext)
    if (typeParam)     match.type     = typeParam

    // Staff filter:
    //   "owner" → movements where staffId is null/missing (owner did it)
    //   an ObjectId string → movements by that staff member
    if (staffIdParam === 'owner') {
      match.staffId = { $in: [null, undefined] }
    } else if (staffIdParam) {
      match.staffId = new Types.ObjectId(staffIdParam)
    }
    // if staffIdParam is null/absent → no filter, include all users

    // ── Aggregation ────────────────────────────────────────────────────────────
    // Group by productId + type so each row = one product's activity for one
    // movement type.  Absolute quantity because SALE is stored as negative.
    const pipeline: any[] = [
      { $match: match },
      {
        $group: {
          _id:          { productId: '$productId', type: '$type' },
          totalQty:     { $sum: { $abs: '$quantity' } },
          transactions: { $sum: 1 },
          staffIds:     { $addToSet: '$staffId' },
        },
      },
      // Join product details
      {
        $lookup: {
          from:         'products',
          localField:   '_id.productId',
          foreignField: '_id',
          as:           'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id:          0,
          productId:    '$_id.productId',
          type:         '$_id.type',
          productName:  '$product.productName',
          brand:        '$product.brand',
          model:        '$product.model',
          variant:      '$product.variant',
          lotUnit:      '$product.lotUnit',
          totalQty:     1,
          transactions: 1,
        },
      },
      { $sort: { productName: 1, type: 1 } },
    ]

    const rows = await (models as any).StockLedger.aggregate(pipeline)

    // ── Fetch staff name for the selected staff member (for report header) ────
    let staffName: string | null = null
    if (staffIdParam && staffIdParam !== 'owner') {
      const staffMember = await models.Staff.findById(staffIdParam)
        .select('name firstName lastName')
        .lean() as any
      if (staffMember) {
        staffName = staffMember.firstName && staffMember.lastName
          ? `${staffMember.firstName} ${staffMember.lastName}`.trim()
          : staffMember.name
      }
    } else if (staffIdParam === 'owner') {
      // Fetch owner name
      const owner = await models.User?.findById(ownerId).select('firstName lastName shopName').lean() as any
      if (owner) {
        staffName = owner.firstName && owner.lastName
          ? `${owner.firstName} ${owner.lastName}`.trim()
          : owner.shopName || 'Owner'
      }
    }

    return NextResponse.json({
      rows,
      meta: {
        startDate:  startDateStr,
        endDate:    endDateStr,
        staffId:    staffIdParam,
        staffName,
        type:       typeParam,
        totalRows:  rows.length,
      },
    })
  } catch (error) {
    console.error('[stock-ledger/summary] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 }
    )
  }
}
