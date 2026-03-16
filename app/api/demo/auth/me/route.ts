import { NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/demo'

export async function GET() {
  return NextResponse.json({ user: { ...getDemoUser(), isDemo: true } })
}
