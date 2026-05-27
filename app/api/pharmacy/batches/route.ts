import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/pharmacy/batches?drugId=&status=active&expiringSoon=true
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(request.url)

    const query: any = { userId: ownerId }
    if (searchParams.get('drugId')) query.drugId = searchParams.get('drugId')
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

    const { drugId, batchNumber, expiryDate, manufactureDate, quantity,
            buyingPrice, sellingPrice, supplier, notes } = body

    if (!drugId || !batchNumber || !expiryDate || !quantity || !buyingPrice) {
      return NextResponse.json({ error: 'drugId, batchNumber, expiryDate, quantity, buyingPrice are required' }, { status: 400 })
    }

    // Check drug exists
    const drug = await models.Drug.findOne({ _id: drugId, userId: ownerId })
    if (!drug) return NextResponse.json({ error: 'Drug not found' }, { status: 404 })

    const batch = new models.DrugBatch({
      userId: ownerId, drugId, batchNumber, expiryDate, manufactureDate,
      quantity, initialQuantity: quantity, buyingPrice,
      sellingPrice: sellingPrice || drug.sellingPrice,
      supplier, notes,
    })
    await batch.save()

    // Update drug's total stock
    await models.Drug.findByIdAndUpdate(drugId, { $inc: { stock: quantity } })

    return NextResponse.json({ batch }, { status: 201 })
  } catch (error) {
    console.error('[pharmacy/batches POST]', error)
    return NextResponse.json({ error: 'Failed to receive stock' }, { status: 500 })
  }
}
