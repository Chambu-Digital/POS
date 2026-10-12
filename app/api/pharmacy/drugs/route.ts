import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''

    // Build query with proper MongoDB syntax
    const filters: any[] = [
      { userId: ownerId, status: 'active' }
    ]
    
    // Filter by branch context if available
    if (branchContext) {
      filters.push({
        $or: [
          { branchId: branchContext },  // Branch-specific drugs
          { branchId: null },            // Global drugs (no branch assignment)
        ]
      })
    }
    
    if (search) {
      filters.push({
        $or: [
          { genericName: { $regex: search, $options: 'i' } },
          { brandName: { $regex: search, $options: 'i' } },
          { barcode: { $regex: search, $options: 'i' } },
        ]
      })
    }
    
    if (category) {
      filters.push({ category })
    }

    const query = filters.length === 1 ? filters[0] : { $and: filters }
    const drugs = await models.Drug.find(query).sort({ genericName: 1 }).lean()
    return NextResponse.json({ drugs })
  } catch (error) {
    console.error('[pharmacy/drugs GET]', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch drugs'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)
    const body = await request.json()

    if (!body.genericName || body.sellingPrice === undefined || body.buyingPrice === undefined) {
      return NextResponse.json({ error: 'genericName, sellingPrice, buyingPrice are required' }, { status: 400 })
    }

    // Associate drug with current branch context if available
    const drug = new models.Drug({ 
      ...body, 
      userId: ownerId,
      branchId: branchContext || null,
    })
    await drug.save()
    return NextResponse.json({ drug }, { status: 201 })
  } catch (error) {
    console.error('[pharmacy/drugs POST]', error)
    const message = error instanceof Error ? error.message : 'Failed to create drug'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
