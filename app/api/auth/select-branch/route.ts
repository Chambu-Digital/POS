import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload, createToken, setAuthCookie } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const body = await request.json()
    const { branchId } = body

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 })
    }

    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Verify the branch belongs to this user
    const branch = await models.Branch.findOne({ _id: branchId, userId: ownerId })
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Update token with selected branch
    const newPayload = {
      ...payload,
      branchId: branchId.toString(),
    }
    const newToken = await createToken(newPayload)
    await setAuthCookie(newToken)

    return NextResponse.json({ success: true, branch })
  } catch (error) {
    console.error('[auth/select-branch POST]', error)
    return NextResponse.json({ error: 'Failed to select branch' }, { status: 500 })
  }
}
