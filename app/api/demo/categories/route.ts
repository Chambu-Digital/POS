import { NextResponse } from 'next/server'
import { getDemoCategories } from '@/lib/demo'

export async function GET() {
  return NextResponse.json({ categories: getDemoCategories() })
}
