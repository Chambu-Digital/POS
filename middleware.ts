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
    // Only intercept if explicitly flagged as demo
    if (payload.isDemo !== true) return NextResponse.next()
  } catch {
    // Token invalid/expired — let the route handle auth normally
    return NextResponse.next()
  }

  // --- Demo user detected ---

  // For write operations, return a shaped fake success
  const method = request.method
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    const fakeId = `demo_${Date.now()}`
    const now = new Date().toISOString()

    // Shape the response based on the route so pages don't crash
    let body: any = { success: true, _demo: true }

    if (pathname.includes('/rentals')) {
      body.rental = {
        _id: fakeId,
        customer: { name: 'Demo Customer', phone: '0700000000' },
        items: [],
        startTime: now,
        deposit: 0,
        status: 'active',
        createdAt: now,
      }
    } else if (pathname.includes('/sales')) {
      body.sale = { _id: fakeId, createdAt: now }
    } else if (pathname.includes('/products')) {
      body.product = { _id: fakeId }
    } else if (pathname.includes('/staff')) {
      body.staff = { _id: fakeId }
    }

    return NextResponse.json(body, { status: method === 'POST' ? 201 : 200 })
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
