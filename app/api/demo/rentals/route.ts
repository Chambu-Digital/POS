import { NextResponse } from 'next/server'
import { getDemoRentals } from '@/lib/demo'

export async function GET() {
  return NextResponse.json({ rentals: getDemoRentals() })
}
