import { NextResponse } from 'next/server'
import { getDemoSales } from '@/lib/demo'

export async function GET() {
  return NextResponse.json({ sales: getDemoSales() })
}
