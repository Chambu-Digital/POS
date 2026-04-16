import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const categoryNames = await models.Product.find({ userId: ownerId }).distinct('category')
    let created = 0, updated = 0

    for (const name of categoryNames) {
      if (!name?.trim()) continue
      const count = await models.Product.countDocuments({ userId: ownerId, category: name })
      const existing = await models.Category.findOne({ userId: ownerId, name })
      if (!existing) { await models.Category.create({ userId: ownerId, name, productCount: count }); created++ }
      else { existing.productCount = count; await existing.save(); updated++ }
    }

    return NextResponse.json({ message: 'Categories synced successfully', created, updated })
  } catch (error) {
    console.error('[categories/sync] POST error:', error)
    return NextResponse.json({ error: 'Failed to sync categories' }, { status: 500 })
  }
}
