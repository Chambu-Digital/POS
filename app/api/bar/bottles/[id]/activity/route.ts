import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

/**
 * GET /api/bar/bottles/[id]/activity
 * 
 * Returns the complete activity timeline for a specific bottle:
 * - Bottle document with metadata
 * - All BarTabLine entries (servings sold from this bottle)
 * - All BarAuditLog entries (lifecycle events)
 * 
 * Merged and sorted by timestamp for a chronological view.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id: bottleId } = await params

    // Validate ObjectId
    if (!Types.ObjectId.isValid(bottleId)) {
      return NextResponse.json({ error: 'Invalid bottle ID' }, { status: 400 })
    }

    // Fetch bottle document with populated references
    const bottle = await models.BarBottle.findOne({
      _id: new Types.ObjectId(bottleId),
      userId: ownerId,
    })
      .populate('inventoryItemId', 'name size brandName brandCategory')
      .populate('openedBy', 'name')
      .populate('closedBy', 'name')
      .lean()

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 })
    }

    // Fetch all tab lines that used this bottle
    const tabLines = await models.BarTabLine.find({
      bottleId: new Types.ObjectId(bottleId),
      voided: false,
    })
      .populate('tabId', 'tabNumber')
      .populate('addedBy', 'name')
      .sort({ addedAt: 1 })
      .lean()

    // Fetch all audit logs for this bottle
    const auditLogs = await models.BarAuditLog.find({
      referenceId: bottleId,
      referenceType: 'BarBottle',
    })
      .populate('staffId', 'name')
      .sort({ timestamp: 1 })
      .lean()

    // Transform tab lines into activity entries
    const servingActivity = tabLines.map((line: any) => ({
      timestamp: line.addedAt,
      type: 'serving_sold' as const,
      servingName: line.servingName || 'Bottle',
      quantity: line.quantity,
      tabNumber: line.tabId?.tabNumber || 'Unknown',
      staffName: line.addedBy?.name || 'Unknown',
      lineTotal: line.lineTotal,
    }))

    // Transform audit logs into activity entries
    const auditActivity = auditLogs.map((log: any) => ({
      timestamp: log.timestamp,
      type: log.operation.toLowerCase().replace('_', '_') as 'bottle_opened' | 'bottle_closed' | 'serving_sold',
      operation: log.operation,
      details: log.details,
      staffName: log.staffId?.name || 'System',
    }))

    // Merge and sort all activity by timestamp
    const allActivity = [...servingActivity, ...auditActivity].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    })

    return NextResponse.json({
      bottle,
      activity: allActivity,
    })
  } catch (error) {
    console.error('[bar/bottles/[id]/activity] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bottle activity' },
      { status: 500 }
    )
  }
}
