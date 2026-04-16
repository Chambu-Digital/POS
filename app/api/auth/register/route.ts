import { NextResponse } from 'next/server'

// Public registration is disabled.
// Accounts are created by the admin panel when onboarding a new tenant.
export async function POST() {
  return NextResponse.json({ error: 'Registration is not available' }, { status: 403 })
}
