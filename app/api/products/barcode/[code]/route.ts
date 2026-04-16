import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const barcode = decodeURIComponent(params.code)

    const product = await models.Product.findOne({ userId: ownerId, barcode })
    if (!product) return NextResponse.json({ product: null }, { status: 404 })

    return NextResponse.json({ product })
  } catch (error) {
    console.error('[barcode] lookup error:', error)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
