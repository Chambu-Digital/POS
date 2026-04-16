import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret')
const ADMIN_CODE = process.env.ADMIN_SECRET_CODE || '@ChambuDIGITAL'
const COOKIE = 'admin_session'

export async function POST(request: NextRequest) {
  const { code } = await request.json()
  if (code !== ADMIN_CODE) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  const token = await new SignJWT({ role: 'superadmin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(secret)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 8 })
  return res
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value
  if (!token) return NextResponse.json({ ok: false }, { status: 401 })
  try {
    await jwtVerify(token, secret)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE)
  return res
}

// Helper used by other admin API routes
export async function verifyAdminSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE)?.value
  if (!token) return false
  try { await jwtVerify(token, secret); return true } catch { return false }
}
