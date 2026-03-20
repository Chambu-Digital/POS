import { NextResponse } from 'next/server'
import { getDemoSettings } from '@/lib/demo'

export async function GET() {
  return NextResponse.json({ settings: getDemoSettings() })
}
