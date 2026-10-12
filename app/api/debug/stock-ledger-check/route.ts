// Debug endpoint to check stock ledger data
import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, conn } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    // Check if StockLedger model exists
    const modelExists = !!(models as any).StockLedger
    const collectionExists = conn.modelNames().includes('StockLedger')

    // Get total count of StockLedger records
    let totalCount = 0
    let branchFilteredCount = null
    let sampleRecords: any[] = []
    let recordsWithoutBranch = 0
    let recordsWithNullBranch = 0
    let allRecordsRaw: any[] = []

    if (modelExists) {
      totalCount = await (models as any).StockLedger.countDocuments({ userId: ownerId })
      
      // Get ALL records to inspect
      allRecordsRaw = await (models as any).StockLedger
        .find({ userId: ownerId })
        .sort({ timestamp: -1 })
        .limit(20)
        .lean()

      // Get count with branchContext filter
      if (branchContext) {
        branchFilteredCount = await (models as any).StockLedger.countDocuments({ 
          userId: ownerId, 
          branchId: branchContext 
        })
      }

      // Get sample records with populated fields
      sampleRecords = await (models as any).StockLedger
        .find({ userId: ownerId })
        .sort({ timestamp: -1 })
        .limit(5)
        .populate('productId', 'productName')
        .populate('branchId', 'name')
        .lean()

      // Check if any records are missing branchId
      recordsWithoutBranch = await (models as any).StockLedger.countDocuments({
        userId: ownerId,
        branchId: { $exists: false }
      })

      recordsWithNullBranch = await (models as any).StockLedger.countDocuments({
        userId: ownerId,
        branchId: null
      })
    }

    return NextResponse.json({
      debug: {
        model: {
          exists: modelExists,
          registered: collectionExists,
          modelNames: conn.modelNames(),
        },
        payload: {
          type: payload.type,
          userId: payload.userId,
          adminId: payload.type === 'staff' ? payload.adminId : null,
          ownerId,
        },
        branchContext,
        counts: {
          total: totalCount,
          withBranchFilter: branchFilteredCount,
          withoutBranchId: recordsWithoutBranch,
          withNullBranchId: recordsWithNullBranch,
        },
        allRecordsRaw: allRecordsRaw.map(r => ({
          id: r._id,
          type: r.type,
          quantity: r.quantity,
          timestamp: r.timestamp,
          productId: r.productId,
          branchId: r.branchId,
          userId: r.userId,
        })),
        sampleRecords: sampleRecords.map(r => ({
          id: r._id,
          type: r.type,
          quantity: r.quantity,
          timestamp: r.timestamp,
          productName: r.productId?.productName || 'N/A',
          branchId: r.branchId,
          branchName: r.branchId?.name || 'No branch',
        })),
      }
    })
  } catch (error) {
    console.error('[debug/stock-ledger-check] Error:', error)
    return NextResponse.json({ error: 'Failed to check stock ledger', details: String(error) }, { status: 500 })
  }
}
