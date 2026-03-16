import { NextResponse } from 'next/server'
import { getDemoDashboardStats } from '@/lib/demo'

export async function GET() {
  return NextResponse.json({ stats: getDemoDashboardStats() })
}
