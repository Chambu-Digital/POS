import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'

// Get single quotation
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const quotation = await models.Quotation
      .findOne({ _id: params.id, userId: ownerId })
      .lean()

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    return NextResponse.json({
      quotation: {
        ...quotation,
        _id: quotation._id.toString(),
        userId: quotation.userId.toString(),
        customerId: quotation.customerId.toString(),
        branchId: quotation.branchId?.toString() || null,
        createdBy: quotation.createdBy?.toString() || null,
        convertedToSaleId: quotation.convertedToSaleId?.toString() || null,
      }
    })
  } catch (error: any) {
    console.error('Get quotation error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quotation', details: error.message },
      { status: 500 }
    )
  }
}

// Update quotation
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const quotation = await models.Quotation.findOne({ _id: params.id, userId: ownerId })
    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Don't allow editing converted quotations
    if (quotation.status === 'converted') {
      return NextResponse.json(
        { error: 'Cannot edit a quotation that has been converted to a sale' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { 
      customerId, 
      customerName, 
      customerPhone,
      customerEmail,
      items, 
      discount,
      validUntil, 
      notes,
      status
    } = body

    // Update fields if provided
    if (customerId !== undefined) quotation.customerId = customerId
    if (customerName !== undefined) quotation.customerName = customerName
    if (customerPhone !== undefined) quotation.customerPhone = customerPhone
    if (customerEmail !== undefined) quotation.customerEmail = customerEmail
    if (validUntil !== undefined) quotation.validUntil = new Date(validUntil)
    if (notes !== undefined) quotation.notes = notes
    if (status !== undefined) quotation.status = status

    // Update items and recalculate totals if items provided
    if (items !== undefined && items.length > 0) {
      quotation.items = items.map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      }))

      quotation.subtotal = quotation.items.reduce((sum, item: any) => sum + item.lineTotal, 0)
      quotation.discount = discount !== undefined ? discount : quotation.discount
      quotation.total = quotation.subtotal - quotation.discount
    } else if (discount !== undefined) {
      quotation.discount = discount
      quotation.total = quotation.subtotal - quotation.discount
    }

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
        convertedToSaleId: quotation.convertedToSaleId?.toString() || null,
      }
    })
  } catch (error: any) {
    console.error('Update quotation error:', error)
    return NextResponse.json(
      { error: 'Failed to update quotation', details: error.message },
      { status: 500 }
    )
  }
}

// Delete quotation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const quotation = await models.Quotation.findOne({ _id: params.id, userId: ownerId })
    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Don't allow deleting converted quotations
    if (quotation.status === 'converted') {
      return NextResponse.json(
        { error: 'Cannot delete a quotation that has been converted to a sale' },
        { status: 400 }
      )
    }

    await quotation.deleteOne()

    return NextResponse.json({ success: true, message: 'Quotation deleted' })
  } catch (error: any) {
    console.error('Delete quotation error:', error)
    return NextResponse.json(
      { error: 'Failed to delete quotation', details: error.message },
      { status: 500 }
    )
  }
}
