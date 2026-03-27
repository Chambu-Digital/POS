import { connectDB } from '@/lib/db'
import Product from '@/lib/models/Product'
import { getAuthPayload } from '@/lib/jwt'
import { uploadMediaFile } from '@/lib/media-upload'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const { id } = await params
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const product = await Product.findOne({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const formData = await request.formData()
    const files = formData.getAll('media') as File[]
    if (!files.length) return NextResponse.json({ error: 'No images provided' }, { status: 400 })

    const urls: string[] = []
    for (const file of files) {
      const result = await uploadMediaFile(file)
      urls.push(result.path)
    }

    product.images = [...(product.images || []), ...urls]
    product.updatedAt = new Date()
    await product.save()

    return NextResponse.json({ images: product.images })
  } catch (error: any) {
    console.error('[Product Images POST]', error)
    return NextResponse.json({ error: error.message ?? 'Failed to upload images' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const { id } = await params
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { index } = await request.json()

    const product = await Product.findOne({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    product.images = (product.images || []).filter((_: string, i: number) => i !== index)
    product.updatedAt = new Date()
    await product.save()

    return NextResponse.json({ images: product.images })
  } catch (error) {
    console.error('[Product Images DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }
}
