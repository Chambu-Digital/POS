import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload, createToken, setAuthCookie } from '@/lib/jwt'
import { setBranchCookie } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'

// ── POST: Owner selects a branch context ──────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (payload.type !== 'user') {
      return NextResponse.json({ error: 'Only business owners can select branches' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)
    const { branchId } = await request.json()

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 })
    }

    // Verify branch belongs to this user
    const branch = await models.Branch.findOne({ _id: branchId, userId: payload.userId })
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Set branch cookie for future requests
    await setBranchCookie(branchId)

    // Optionally update JWT token with new branchId
    const newToken = await createToken({
      ...payload,
      branchId: branchId,
    })
    await setAuthCookie(newToken)

    return NextResponse.json({
      message: 'Branch selected successfully',
      branch: {
        id: branch._id,
        name: branch.name,
        code: branch.code,
      },
    })
  } catch (error) {
    console.error('[select-branch] POST error:', error)
    return NextResponse.json({ error: 'Failed to select branch' }, { status: 500 })
  }
}
