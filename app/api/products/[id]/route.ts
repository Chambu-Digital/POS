import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const { id } = await params
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const product = await models.Product.findOne({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    // Clean empty strings for ObjectId fields (convert to undefined)
    const cleanedData = { ...data }
    if (cleanedData.supplierId === '') cleanedData.supplierId = undefined
    if (cleanedData.categoryId === '') cleanedData.categoryId = undefined
    if (cleanedData.branchId === '') cleanedData.branchId = undefined

    // Round prices to 2 decimal places on save
    const r2 = (v: any) => v != null ? Math.round(parseFloat(v) * 100) / 100 : v
    if (cleanedData.sellingPrice != null) cleanedData.sellingPrice = r2(cleanedData.sellingPrice)
    if (cleanedData.buyingPrice  != null) cleanedData.buyingPrice  = r2(cleanedData.buyingPrice)
    if (cleanedData.wholeSale    != null) cleanedData.wholeSale    = r2(cleanedData.wholeSale)

    Object.assign(product, cleanedData)
    product.updatedAt = new Date()
    await product.save()
    return NextResponse.json(product)
  } catch (error) {
    console.error('[product] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { id } = await params
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const product = await models.Product.findOneAndDelete({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    return NextResponse.json({ message: 'Product deleted' })
  } catch (error) {
    console.error('[product] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
