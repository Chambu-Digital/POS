import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const branch = await models.Branch.findOne({ _id: params.id, userId: ownerId }).lean()
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })

    return NextResponse.json({ branch })
  } catch (error) {
    console.error('[branches GET by id]', error)
    return NextResponse.json({ error: 'Failed to fetch branch' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only business owners can update branches
    if (payload.type === 'staff') {
      return NextResponse.json({ error: 'Only business owners can update branches' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)
    const body = await request.json()

    const branch = await models.Branch.findOneAndUpdate(
      { _id: params.id, userId: payload.userId },
      { ...body, updatedAt: new Date() },
      { new: true }
    )

    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })

    return NextResponse.json({ branch })
  } catch (error) {
    console.error('[branches PUT]', error)
    return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only business owners can delete branches
    if (payload.type === 'staff') {
      return NextResponse.json({ error: 'Only business owners can delete branches' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)

    // Check if this is the default branch
    const branch = await models.Branch.findOne({ _id: params.id, userId: payload.userId })
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    if (branch.isDefault) {
      return NextResponse.json({ error: 'Cannot delete default branch' }, { status: 400 })
    }

    // Check if branch has inventory or transactions
    const inventoryCount = await models.Inventory.countDocuments({ branchId: params.id })
    const transactionCount = await models.InventoryTransaction.countDocuments({ branchId: params.id })

    if (inventoryCount > 0 || transactionCount > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete branch with inventory or transactions. Archive it instead.' 
      }, { status: 400 })
    }

    await models.Branch.findOneAndDelete({ _id: params.id, userId: payload.userId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[branches DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500 })
  }
}
