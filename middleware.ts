import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

// Routes that should never be rewritten (auth always runs normally)
const AUTH_PASSTHROUGH = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/staff-login',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only intercept API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // Never rewrite auth routes
  if (AUTH_PASSTHROUGH.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Already a demo route — let it through
  if (pathname.startsWith('/api/demo/')) return NextResponse.next()

  // Read JWT from cookie
  const token = request.cookies.get('auth_token')?.value
  if (!token) return NextResponse.next()

  try {
    const { payload } = await jwtVerify(token, secret)
    if (!payload.isDemo) return NextResponse.next()
  } catch {
    return NextResponse.next()
  }

  // --- Demo user detected ---

  // For write operations, return a generic success immediately
  // without hitting any real route or DB
  const method = request.method
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    return NextResponse.json(
      { success: true, message: 'Demo mode — changes are not saved', _demo: true },
      { status: method === 'POST' ? 201 : 200 }
    )
  }

  // For GET requests, rewrite to /api/demo/[...rest]
  // e.g. /api/products → /api/demo/products
  //      /api/dashboard/stats → /api/demo/dashboard/stats
  const rest = pathname.replace('/api/', '')
  const demoUrl = request.nextUrl.clone()
  demoUrl.pathname = `/api/demo/${rest}`

  return NextResponse.rewrite(demoUrl)
}

export const config = {
  matcher: '/api/:path*',
}
