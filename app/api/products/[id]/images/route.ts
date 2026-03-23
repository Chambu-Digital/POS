import { connectDB } from '@/lib/db'
import Product from '@/lib/models/Product'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// Max ~2MB per image as base64
const MAX_SIZE = 2 * 1024 * 1024

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
    const files = formData.getAll('images') as File[]

    if (!files.length) return NextResponse.json({ error: 'No images provided' }, { status: 400 })

    const newImages: string[] = []
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: `Image "${file.name}" exceeds 2MB limit` }, { status: 400 })
      }
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const dataUrl = `data:${file.type};base64,${base64}`
      newImages.push(dataUrl)
    }

    product.images = [...(product.images || []), ...newImages]
    product.updatedAt = new Date()
    await product.save()

    return NextResponse.json({ images: product.images })
  } catch (error) {
    console.error('[Product Images POST]', error)
    return NextResponse.json({ error: 'Failed to upload images' }, { status: 500 })
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
