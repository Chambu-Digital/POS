import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const query: any = { userId: ownerId }
    if (status) query.status = status

    const branches = await models.Branch.find(query).sort({ createdAt: -1 }).lean()
    return NextResponse.json({ branches })
  } catch (error) {
    console.error('[branches GET]', error)
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only business owners can create branches
    if (payload.type === 'staff') {
      return NextResponse.json({ error: 'Only business owners can create branches' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)
    const body = await request.json()

    if (!body.name || !body.code) {
      return NextResponse.json({ error: 'name and code are required' }, { status: 400 })
    }

    // Check if this is the first branch - make it default
    const existingCount = await models.Branch.countDocuments({ userId: payload.userId })
    const isDefault = existingCount === 0

    const branch = new models.Branch({
      ...body,
      userId: payload.userId,
      code: body.code.toUpperCase(),
      isDefault: isDefault,
    })
    await branch.save()

    return NextResponse.json({ branch }, { status: 201 })
  } catch (error: any) {
    console.error('[branches POST]', error)
    if (error.code === 11000) {
      return NextResponse.json({ error: 'Branch code already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 })
  }
}
