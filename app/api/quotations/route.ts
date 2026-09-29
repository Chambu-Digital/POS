import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'

// Generate quotation number (QT-YYYY-NNN)
function generateQuotationNumber(lastNumber: string | null): string {
  const year = new Date().getFullYear()
  const yearStr = year.toString()
  
  if (!lastNumber) {
    return `QT-${yearStr}-001`
  }
  
  // Extract year and sequence from last number (e.g., "QT-2026-042")
  const match = lastNumber.match(/QT-(\d{4})-(\d+)/)
  if (!match) {
    return `QT-${yearStr}-001`
  }
  
  const lastYear = match[1]
  const lastSeq = parseInt(match[2], 10)
  
  // If year changed, reset sequence
  if (lastYear !== yearStr) {
    return `QT-${yearStr}-001`
  }
  
  // Increment sequence
  const nextSeq = (lastSeq + 1).toString().padStart(3, '0')
  return `QT-${yearStr}-${nextSeq}`
}

// Create a new quotation
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    
    const body = await request.json()
    const { 
      customerId, 
      customerName, 
      customerPhone,
      customerEmail,
      items, 
      discount = 0,
      validUntil, 
      notes = '',
      status = 'draft'
    } = body

    // Validation
    if (!customerId || !customerName) {
      return NextResponse.json({ error: 'Customer is required' }, { status: 400 })
    }
    
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }
    
    if (!validUntil) {
      return NextResponse.json({ error: 'Valid until date is required' }, { status: 400 })
    }

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => {
      return sum + (item.quantity * item.unitPrice)
    }, 0)
    
    const total = subtotal - (discount || 0)

    // Generate quotation number
    const lastQuotation = await models.Quotation
      .findOne({ userId: ownerId })
      .sort({ createdAt: -1 })
      .select('quotationNumber')
      .lean()

    const quotationNumber = generateQuotationNumber(lastQuotation?.quotationNumber || null)

    // Create quotation
    const quotation = new models.Quotation({
      userId: ownerId,
      branchId: payload.branchId || null,
      quotationNumber,
      customerId,
      customerName,
      customerPhone: customerPhone || '',
      customerEmail: customerEmail || '',
      status,
      items: items.map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      })),
      subtotal,
      discount: discount || 0,
      total,
      validUntil: new Date(validUntil),
      notes: notes || '',
      createdBy: payload.userId,
      createdByModel: payload.type === 'staff' ? 'Staff' : 'User',
    })

    await quotation.save()

    return NextResponse.json({
      success: true,
      quotation: {
        ...quotation.toObject(),
        _id: quotation._id.toString(),
        userId: quotation.userId.toString(),
        customerId: quotation.customerId.toString(),
        branchId: quotation.branchId?.toString() || null,
        createdBy: quotation.createdBy?.toString() || null,
      }
    })
  } catch (error: any) {
    console.error('Create quotation error:', error)
    return NextResponse.json(
      { error: 'Failed to create quotation', details: error.message },
      { status: 500 }
    )
  }
}

// List quotations
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const search = searchParams.get('search')

    const query: any = { userId: ownerId }
    if (status) query.status = status
    if (customerId) query.customerId = customerId
    if (search) {
      query.$or = [
        { quotationNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } }
      ]
    }

    // Auto-expire quotations
    const now = new Date()
    await models.Quotation.updateMany(
      {
        userId: ownerId,
        status: { $in: ['draft', 'sent'] },
        validUntil: { $lt: now }
      },
      { $set: { status: 'expired' } }
    )

    const quotations = await models.Quotation
      .find(query)
      .sort({ createdAt: -1 })
      .lean()
      .then(docs => docs.map(doc => ({
        ...doc,
        _id: doc._id.toString(),
        userId: doc.userId.toString(),
        customerId: doc.customerId.toString(),
        branchId: doc.branchId?.toString() || null,
        createdBy: doc.createdBy?.toString() || null,
        convertedToSaleId: doc.convertedToSaleId?.toString() || null,
      })))

    return NextResponse.json({ quotations })
  } catch (error: any) {
    console.error('List quotations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quotations', details: error.message },
      { status: 500 }
    )
  }
}
