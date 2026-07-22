import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { createInventoryTransaction } from '@/lib/inventory-service'

// GET /api/pharmacy/batches?drugId=&status=active&expiringSoon=true&branchId=
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(request.url)

    const query: any = { userId: ownerId }
    if (searchParams.get('drugId')) query.drugId = searchParams.get('drugId')
    if (searchParams.get('branchId')) query.branchId = new Types.ObjectId(searchParams.get('branchId'))
    if (searchParams.get('status')) query.status = searchParams.get('status')
    else query.status = { $in: ['active'] }

    // Expiring within 90 days
    if (searchParams.get('expiringSoon') === 'true') {
      const soon = new Date()
      soon.setDate(soon.getDate() + 90)
      query.expiryDate = { $lte: soon, $gte: new Date() }
      delete query.status
    }

    // Auto-mark expired batches
    await models.DrugBatch.updateMany(
      { userId: ownerId, expiryDate: { $lt: new Date() }, status: 'active' },
      { $set: { status: 'expired' } }
    )

    const batches = await models.DrugBatch.find(query)
      .populate('drugId', 'genericName brandName unit category barcode')
      .sort({ expiryDate: 1 })
      .lean()

    return NextResponse.json({ batches })
  } catch (error) {
    console.error('[pharmacy/batches GET]', error)
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 })
  }
}

// POST /api/pharmacy/batches — receive new stock
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const body = await request.json()

    const { drugId, manufacturerLot, expiryDate, manufactureDate, quantity,
            buyingPrice, sellingPrice, supplier, invoiceNumber, poReference, notes, branchId } = body

    if (!drugId || !expiryDate || !quantity || !buyingPrice) {
      return NextResponse.json({ error: 'drugId, expiryDate, quantity, buyingPrice are required' }, { status: 400 })
    }

    // Check drug exists
    const drug = await models.Drug.findOne({ _id: drugId, userId: ownerId })
    if (!drug) return NextResponse.json({ error: 'Drug not found' }, { status: 404 })

    // Get or determine branchId
    let targetBranchId = branchId
    if (!targetBranchId) {
      const defaultBranch = await models.Branch.findOne({ userId: ownerId, isDefault: true })
      if (defaultBranch) {
        targetBranchId = defaultBranch._id.toString()
      } else {
        // If no branches exist yet, create a default one
        const newBranch = new models.Branch({
          userId: ownerId,
          name: 'Main Branch',
          code: 'MAIN',
          isDefault: true,
        })
        await newBranch.save()
        targetBranchId = newBranch._id.toString()
      }
    }

    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '') // YYMMDD
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase()
    const internalBatchId = `BAT-${dateStr}-${randomStr}`

    const batch = new models.DrugBatch({
      userId: ownerId,
      branchId: new Types.ObjectId(targetBranchId),
      drugId,
      internalBatchId,
      manufacturerLot: manufacturerLot || '',
      expiryDate,
      manufactureDate,
      quantity,
      initialQuantity: quantity,
      buyingPrice,
      sellingPrice: sellingPrice || drug.sellingPrice,
      supplier: supplier || '',
      invoiceNumber: invoiceNumber || '',
      poReference: poReference || '',
      notes,
    })
    await batch.save()

    // Create inventory transaction for stock intake
    await createInventoryTransaction(models, {
      userId: ownerId,
      branchId: targetBranchId,
      drugId,
      batchId: batch._id.toString(),
      type: 'IN',
      quantity,
      referenceId: batch._id.toString(),
      referenceType: 'batch',
      userIdPerformed: payload.type === 'staff' ? payload.userId : undefined,
      reason: `Stock intake - Batch ${internalBatchId}`,
    })

    // Update drug's total stock
    await models.Drug.findByIdAndUpdate(drugId, { $inc: { stock: quantity } })

    return NextResponse.json({ batch }, { status: 201 })
  } catch (error) {
    console.error('[pharmacy/batches POST]', error)
    return NextResponse.json({ error: 'Failed to receive stock' }, { status: 500 })
  }
}
