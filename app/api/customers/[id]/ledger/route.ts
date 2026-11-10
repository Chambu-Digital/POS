import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

/**
 * GET /api/customers/[id]/ledger
 *
 * Returns paginated, filtered ledger entries for a customer with resolved
 * display names for branch and served-by fields.
 *
 * Query params:
 *   from      ISO date string — start of date range (inclusive)
 *   to        ISO date string — end of date range (inclusive, defaults to now)
 *   type      comma-separated ledger types: purchase,payment,deposit,deposit_use,deposit_refund,adjustment,deposit_return
 *   branchId  ObjectId — filter to entries from a specific branch
 *   servedBy  ObjectId — filter to entries recorded by a specific staff/user
 *   page      number (default 1)
 *   limit     number (default 50, max 200)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid customer id' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)

    // ── Parse filter params ──────────────────────────────────────────────────
    const fromParam    = searchParams.get('from')
    const toParam      = searchParams.get('to')
    const typeParam    = searchParams.get('type')     // comma-separated
    const branchParam  = searchParams.get('branchId')
    const servedParam  = searchParams.get('servedBy')
    const page         = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit        = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')))

    // ── Fetch customer ───────────────────────────────────────────────────────
    const customer = await models.Customer.findOne({
      _id: new Types.ObjectId(id),
      userId: ownerId,
    }).lean() as any

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // ── Filter ledger entries in-memory ──────────────────────────────────────
    // The ledger is embedded so we filter after fetch. For very large ledgers
    // (thousands of entries) a future optimisation could use $unwind aggregation,
    // but embedded docs are bounded by MongoDB's 16MB document limit in practice.

    const fromDate = fromParam ? new Date(fromParam) : null
    const toDate   = toParam   ? new Date(toParam)   : null
    if (toDate) toDate.setHours(23, 59, 59, 999) // inclusive end of day

    const allowedTypes = typeParam
      ? new Set(typeParam.split(',').map(t => t.trim()).filter(Boolean))
      : null

    const branchFilter = branchParam && Types.ObjectId.isValid(branchParam)
      ? branchParam
      : null

    const servedFilter = servedParam && Types.ObjectId.isValid(servedParam)
      ? servedParam
      : null

    let entries: any[] = customer.ledger ?? []

    if (fromDate)      entries = entries.filter(e => new Date(e.date) >= fromDate)
    if (toDate)        entries = entries.filter(e => new Date(e.date) <= toDate)
    if (allowedTypes)  entries = entries.filter(e => allowedTypes.has(e.type))
    if (branchFilter)  entries = entries.filter(e => e.branchId?.toString() === branchFilter)
    if (servedFilter)  entries = entries.filter(e => e.collectedBy?.toString() === servedFilter)

    // Sort newest first
    entries = entries.slice().sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    const total   = entries.length
    const offset  = (page - 1) * limit
    const paged   = entries.slice(offset, offset + limit)

    // ── Resolve branch and staff names ───────────────────────────────────────
    // Collect unique IDs to resolve in bulk
    const branchIds = new Set<string>()
    const staffIds  = new Set<string>()

    for (const e of paged) {
      if (e.branchId)     branchIds.add(e.branchId.toString())
      if (e.collectedBy)  staffIds.add(e.collectedBy.toString())
    }

    // Fetch branches
    const branchNameMap = new Map<string, string>()
    if (branchIds.size > 0) {
      const branches = await models.Branch.find({
        _id: { $in: Array.from(branchIds).map(bid => new Types.ObjectId(bid)) },
      }).select('_id name').lean() as any[]
      for (const b of branches) {
        branchNameMap.set(b._id.toString(), b.name)
      }
    }

    // Fetch staff — could be User or Staff depending on collectedByType
    const staffNameMap = new Map<string, string>()
    if (staffIds.size > 0) {
      const ids = Array.from(staffIds).map(sid => new Types.ObjectId(sid))

      const [staffMembers, users] = await Promise.all([
        models.Staff.find({ _id: { $in: ids } })
          .select('_id name firstName lastName')
          .lean() as Promise<any[]>,
        models.User.find({ _id: { $in: ids } })
          .select('_id shopName firstName lastName')
          .lean() as Promise<any[]>,
      ])

      for (const s of staffMembers) {
        const name = s.firstName && s.lastName
          ? `${s.firstName} ${s.lastName}`.trim()
          : s.name || 'Staff'
        staffNameMap.set(s._id.toString(), name)
      }
      for (const u of users) {
        const name = u.firstName && u.lastName
          ? `${u.firstName} ${u.lastName}`.trim()
          : u.shopName || 'Owner'
        staffNameMap.set(u._id.toString(), name)
      }
    }

    // ── Shape response entries ───────────────────────────────────────────────
    const shaped = paged.map(e => ({
      _id:              e._id?.toString(),
      date:             e.date,
      type:             e.type,
      amount:           e.amount,
      balance:          e.balance,
      note:             e.note || '',
      saleId:           e.saleId?.toString() || null,
      depositId:        e.depositId?.toString() || null,
      paymentMethod:    e.paymentMethod || null,
      mpesaCode:        e.mpesaCode || null,
      bankProviderName: e.bankProviderName || null,
      customMethodName: e.customMethodName || null,
      // Resolved attribution
      branchId:         e.branchId?.toString() || null,
      branchName:       e.branchId ? (branchNameMap.get(e.branchId.toString()) || 'Unknown Branch') : null,
      servedById:       e.collectedBy?.toString() || null,
      servedByName:     e.collectedBy ? (staffNameMap.get(e.collectedBy.toString()) || 'Unknown') : null,
      servedByType:     e.collectedByType || null,
    }))

    return NextResponse.json({
      entries:  shaped,
      total,
      page,
      limit,
      pages:    Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[customers/ledger] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch ledger' }, { status: 500 })
  }
}
