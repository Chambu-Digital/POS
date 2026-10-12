// Comprehensive diagnostic endpoint for Stock Movements issues
import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'

export async function GET(request: NextRequest) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {},
    errors: [],
  }

  try {
    // ===== TEST 1: Authentication =====
    diagnostics.tests.push({ name: 'Authentication', status: 'running' })
    const payload = await getAuthPayload()
    if (!payload) {
      diagnostics.tests[0].status = 'FAILED'
      diagnostics.tests[0].error = 'No authentication payload found'
      return NextResponse.json(diagnostics, { status: 401 })
    }
    diagnostics.tests[0].status = 'PASSED'
    diagnostics.tests[0].data = {
      type: payload.type,
      userId: payload.userId,
      adminId: payload.type === 'staff' ? payload.adminId : null,
    }

    // ===== TEST 2: Database Connection =====
    diagnostics.tests.push({ name: 'Database Connection', status: 'running' })
    const { models, conn } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    diagnostics.tests[1].status = 'PASSED'
    diagnostics.tests[1].data = {
      connected: conn.readyState === 1,
      readyState: conn.readyState,
      dbName: conn.name,
    }

    // ===== TEST 3: Branch Context =====
    diagnostics.tests.push({ name: 'Branch Context', status: 'running' })
    const branchContext = await getBranchContext(request)
    diagnostics.tests[2].status = 'PASSED'
    diagnostics.tests[2].data = {
      branchContext,
      hasContext: !!branchContext,
    }

    // ===== TEST 4: StockLedger Model =====
    diagnostics.tests.push({ name: 'StockLedger Model', status: 'running' })
    const modelExists = !!(models as any).StockLedger
    const registeredModels = conn.modelNames()
    diagnostics.tests[3].status = modelExists ? 'PASSED' : 'FAILED'
    diagnostics.tests[3].data = {
      exists: modelExists,
      registeredModels,
      hasStockLedger: registeredModels.includes('StockLedger'),
    }

    if (!modelExists) {
      diagnostics.errors.push('StockLedger model does not exist')
      return NextResponse.json(diagnostics, { status: 500 })
    }

    // ===== TEST 5: Total StockLedger Records =====
    diagnostics.tests.push({ name: 'Total StockLedger Records', status: 'running' })
    const totalCount = await (models as any).StockLedger.countDocuments({ userId: ownerId })
    diagnostics.tests[4].status = totalCount > 0 ? 'PASSED' : 'WARNING'
    diagnostics.tests[4].data = {
      count: totalCount,
      message: totalCount === 0 ? 'No StockLedger records found for this user' : `Found ${totalCount} records`,
    }

    // ===== TEST 6: Records With branchId =====
    diagnostics.tests.push({ name: 'Records With branchId', status: 'running' })
    const withBranchId = await (models as any).StockLedger.countDocuments({
      userId: ownerId,
      branchId: { $exists: true, $ne: null },
    })
    const withoutBranchId = await (models as any).StockLedger.countDocuments({
      userId: ownerId,
      branchId: { $exists: false },
    })
    const withNullBranchId = await (models as any).StockLedger.countDocuments({
      userId: ownerId,
      branchId: null,
    })
    diagnostics.tests[5].status = withBranchId > 0 ? 'PASSED' : 'WARNING'
    diagnostics.tests[5].data = {
      withBranchId,
      withoutBranchId,
      withNullBranchId,
      total: totalCount,
    }

    if (withoutBranchId > 0 || withNullBranchId > 0) {
      diagnostics.errors.push(`Found ${withoutBranchId + withNullBranchId} records without valid branchId`)
    }

    // ===== TEST 7: Branch-Filtered Query (What API returns) =====
    diagnostics.tests.push({ name: 'Branch-Filtered Query', status: 'running' })
    const query: any = { userId: ownerId }
    if (branchContext) {
      query.branchId = branchContext
    }
    const filteredCount = await (models as any).StockLedger.countDocuments(query)
    diagnostics.tests[6].status = filteredCount > 0 ? 'PASSED' : 'FAILED'
    diagnostics.tests[6].data = {
      query,
      count: filteredCount,
      message: filteredCount === 0 
        ? 'No records match the branch filter - THIS IS WHY PAGE IS EMPTY' 
        : `Found ${filteredCount} records with branch filter`,
    }

    // ===== TEST 8: Sample Records =====
    diagnostics.tests.push({ name: 'Sample Records', status: 'running' })
    const sampleRecords = await (models as any).StockLedger
      .find({ userId: ownerId })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean()
    diagnostics.tests[7].status = 'PASSED'
    diagnostics.tests[7].data = {
      samples: sampleRecords.map((r: any) => ({
        id: r._id,
        type: r.type,
        quantity: r.quantity,
        timestamp: r.timestamp,
        productId: r.productId,
        branchId: r.branchId,
        hasBranchId: !!r.branchId,
        matchesBranchContext: branchContext ? String(r.branchId) === String(branchContext) : 'N/A',
      })),
    }

    // ===== TEST 9: Branch Records =====
    diagnostics.tests.push({ name: 'Branch Records', status: 'running' })
    const branches = await models.Branch.find({ userId: ownerId }).select('_id name code').lean()
    diagnostics.tests[8].status = 'PASSED'
    diagnostics.tests[8].data = {
      count: branches.length,
      branches: branches.map((b: any) => ({
        id: b._id,
        name: b.name,
        code: b.code,
        isCurrentContext: String(b._id) === String(branchContext),
      })),
    }

    // ===== TEST 10: Movement Type Distribution =====
    diagnostics.tests.push({ name: 'Movement Type Distribution', status: 'running' })
    const typeDistribution = await (models as any).StockLedger.aggregate([
      { $match: { userId: ownerId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    diagnostics.tests[9].status = 'PASSED'
    diagnostics.tests[9].data = {
      types: typeDistribution,
    }

    // ===== SUMMARY =====
    diagnostics.summary = {
      authenticated: !!payload,
      modelExists,
      totalRecords: totalCount,
      recordsWithBranchId: withBranchId,
      recordsWithoutBranchId: withoutBranchId + withNullBranchId,
      branchFilteredRecords: filteredCount,
      branchCount: branches.length,
      currentBranch: branchContext,
      
      // Root cause analysis
      rootCause: filteredCount === 0 && totalCount > 0
        ? branchContext
          ? `BRANCH FILTER MISMATCH: ${totalCount} records exist but none match branchId=${branchContext}. Old records may be missing branchId.`
          : 'NO BRANCH CONTEXT: User has no branch assigned, but records require branchId'
        : filteredCount === 0 && totalCount === 0
        ? 'NO DATA: No StockLedger records exist yet. Create a sale or stock movement to generate data.'
        : 'OK: Data exists and passes filters',
      
      recommendation: filteredCount === 0 && totalCount > 0 && (withoutBranchId + withNullBranchId) > 0
        ? 'Run migration script to backfill branchId on existing StockLedger records'
        : filteredCount === 0 && totalCount === 0
        ? 'Create test data by making a sale or adding stock'
        : 'No action needed',
    }

    return NextResponse.json(diagnostics, { status: 200 })
  } catch (error) {
    diagnostics.errors.push({
      message: 'Unhandled error during diagnostics',
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(diagnostics, { status: 500 })
  }
}
