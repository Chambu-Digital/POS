import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { models } = await getTenantDB(request)
    const { id } = await params
    const drug = await models.Drug.findById(id).lean()
    if (!drug) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ drug })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { models } = await getTenantDB(request)
    const { id } = await params
    const data = await request.json()
    const drug = await models.Drug.findByIdAndUpdate(id, { $set: data }, { new: true })
    if (!drug) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ drug })
  } catch { return NextResponse.json({ error: 'Failed to update' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { models } = await getTenantDB(request)
    const { id } = await params
    // Soft delete
    await models.Drug.findByIdAndUpdate(id, { $set: { isActive: false } })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Failed to delete' }, { status: 500 }) }
}
