import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.menu']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const { categoryIds } = await request.json()

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return NextResponse.json({ error: 'categoryIds array is required' }, { status: 400 })
    }

    // Update display order for each category
    const updates = categoryIds.map((id, index) =>
      models.HospitalityCategory.findOneAndUpdate(
        { _id: id, tenantId },
        { $set: { displayOrder: index } },
        { new: true }
      )
    )

    await Promise.all(updates)

    return NextResponse.json({ message: 'Categories reordered successfully' })
  } catch (error) {
    console.error('[hospitality/categories/reorder PUT]', error)
    return NextResponse.json({ error: 'Failed to reorder categories' }, { status: 500 })
  }
}
