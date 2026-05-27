import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { id } = await params
    const data = await request.json()

    const batch = await models.DrugBatch.findByIdAndUpdate(id, { $set: data }, { new: true })
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    return NextResponse.json({ batch })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update batch' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { id } = await params

    const batch = await models.DrugBatch.findById(id)
    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Reverse stock on drug
    await models.Product.findByIdAndUpdate(batch.drugId, { $inc: { stock: -batch.quantity } })
    await models.DrugBatch.findByIdAndDelete(id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete batch' }, { status: 500 })
  }
}
