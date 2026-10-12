import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload, createToken, setAuthCookie } from '@/lib/jwt'
import { setBranchCookie } from '@/lib/branch-context'
import { activeOnlyQuery } from '@/lib/branch-validation'
import { NextRequest, NextResponse } from 'next/server'

// ── POST: Owner selects a branch context ──────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // Allow both owners and branch managers
    if (payload.type !== 'user' && payload.type !== 'staff') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)
    const { branchId } = await request.json()

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 })
    }

    // Verify branch belongs to this user AND is active
    const branch = await models.Branch.findOne(
      activeOnlyQuery({ _id: branchId, userId: payload.userId })
    )
    if (!branch) {
      return NextResponse.json({ 
        error: 'Branch not found or is not active. Please select an active branch.' 
      }, { status: 404 })
    }

    // For branch managers, verify they manage this branch
    if (payload.type === 'staff' && payload.isBranchManager) {
      const managesThisBranch = payload.managerOfBranches?.some(
        (bid: string) => bid === branchId || bid.toString() === branchId.toString()
      )
      if (!managesThisBranch) {
        return NextResponse.json({
          error: 'You do not have permission to switch to this branch'
        }, { status: 403 })
      }
    }

    // Set branch cookie for future requests
    await setBranchCookie(branchId)

    // Update JWT token with new branchId
    const { exp, iat, ...cleanPayload } = payload as any
    const newToken = await createToken({
      ...cleanPayload,
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

// ── GET: Get current branch context with fallback info ────────────────────────
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (payload.type !== 'user') {
      return NextResponse.json({ error: 'Only business owners can view branch context' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)

    // Get all active branches for fallback info
    const branches = await models.Branch.find(
      activeOnlyQuery({ userId: payload.userId })
    ).sort({ isDefault: -1, createdAt: 1 }).lean()

    if (branches.length === 0) {
      return NextResponse.json({ 
        error: 'No active branches found. Please create a branch first.' 
      }, { status: 400 })
    }

    return NextResponse.json({
      currentBranch: payload.branchId || null,
      availableBranches: branches,
      defaultBranch: branches.find((b: any) => b.isDefault) || branches[0],
    })
  } catch (error) {
    console.error('[select-branch] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch branch info' }, { status: 500 })
  }
}
