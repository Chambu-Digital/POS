import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const BAR_PLACEHOLDER_ID = new mongoose.Types.ObjectId('000000000000000000000001')
    const items = (data.items as { name: string; quantity: number; price: number }[]).map(item => ({
      productId: BAR_PLACEHOLDER_ID, productName: item.name,
      quantity: item.quantity, price: item.price, discount: 0,
    }))

    const sale = new models.Sale({
      userId: ownerId, staffId: payload.type === 'staff' ? payload.userId : null,
      items, subtotal: data.subtotal, discount: data.discount ?? 0, total: data.total,
      paymentMethod: data.paymentMethod, mpesaCode: data.mpesaCode ?? null,
      mpesaPhone: data.mpesaPhone ?? null, notes: data.notes ?? `Bar tab ${data.tabNumber}`,
      source: 'bar', status: data.status ?? 'completed', synced: true,
    })
    await sale.save()
    return NextResponse.json({ sale }, { status: 201 })
  } catch (error) {
    console.error('[Bar] Sale POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save sale' }, { status: 500 })
  }
}
