import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { validateBranchActive } from '@/lib/branch-validation'
import { clearBranchCookie } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params

    const branch = await models.Branch.findOne({ _id: id, userId: ownerId }).lean()
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })

    return NextResponse.json({ branch })
  } catch (error) {
    console.error('[branches GET by id]', error)
    return NextResponse.json({ error: 'Failed to fetch branch' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only business owners can update branches
    if (payload.type === 'staff') {
      return NextResponse.json({ error: 'Only business owners can update branches' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)
    const body = await request.json()
    const { id } = await params

    // Get current branch
    const currentBranch = await models.Branch.findOne({ _id: id, userId: payload.userId })
    if (!currentBranch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Prevent setting to inactive/closed via update if it has staff assignments
    if (body.status && body.status !== currentBranch.status) {
      if (body.status !== 'active') {
        // Check if branch has staff assigned
        const staffCount = await models.Staff.countDocuments({ branchId: id, active: true })
        if (staffCount > 0) {
          return NextResponse.json({ 
            error: 'Cannot set branch to inactive/closed while staff are assigned. Reassign staff first.' 
          }, { status: 400 })
        }
      }
    }

    const branch = await models.Branch.findOneAndUpdate(
      { _id: id, userId: payload.userId },
      { ...body, updatedAt: new Date() },
      { new: true }
    )

    return NextResponse.json({ branch })
  } catch (error) {
    console.error('[branches PUT]', error)
    return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only business owners can delete branches
    if (payload.type === 'staff') {
      return NextResponse.json({ error: 'Only business owners can delete branches' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)
    const { id } = await params

    // Check if this is the default branch
    const branch = await models.Branch.findOne({ _id: id, userId: payload.userId })
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    
    if (branch.isDefault) {
      return NextResponse.json({ error: 'Cannot delete default branch. Set another branch as default first.' }, { status: 400 })
    }

    // Check if branch has inventory or transactions (both pharmacy and retail)
    const [pharmacyInventoryCount, pharmacyTransactionCount, retailInventoryCount] = await Promise.all([
      models.Inventory.countDocuments({ branchId: id }),
      models.InventoryTransaction.countDocuments({ branchId: id }),
      models.ProductInventory.countDocuments({ branchId: id }),
    ])

    if (pharmacyInventoryCount > 0 || pharmacyTransactionCount > 0 || retailInventoryCount > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete branch with inventory or transactions. Archive it instead.' 
      }, { status: 400 })
    }

    // Delete the branch
    const deletedBranch = await models.Branch.findOneAndDelete({ _id: id, userId: payload.userId })

    // If owner's cookie points to deleted branch, clear it (will fallback to default on next request)
    await clearBranchCookie()

    return NextResponse.json({ 
      success: true,
      message: 'Branch deleted successfully'
    })
  } catch (error) {
    console.error('[branches DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500 })
  }
}
