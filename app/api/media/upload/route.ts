import { getAuthPayload } from '@/lib/jwt'
import { uploadMediaFile } from '@/lib/media-upload'
import { NextRequest, NextResponse } from 'next/server'

// Generic upload endpoint — used by product form before a product _id exists
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('media') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const result = await uploadMediaFile(file)
    return NextResponse.json({ url: result.path })
  } catch (error: any) {
    console.error('[Media Upload]', error)
    return NextResponse.json({ error: error.message ?? 'Upload failed' }, { status: 500 })
  }
}
