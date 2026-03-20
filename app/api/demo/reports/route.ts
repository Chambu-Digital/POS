import { NextResponse } from 'next/server'
import { getDemoSales, getDemoProducts, getDemoRentals } from '@/lib/demo'

export async function GET() {
  return NextResponse.json({ reports: [] })
}
