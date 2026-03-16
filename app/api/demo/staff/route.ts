import { NextResponse } from 'next/server'
import { getDemoStaff } from '@/lib/demo'

export async function GET() {
  return NextResponse.json({ staff: getDemoStaff() })
}
