import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export const runtime = 'nodejs'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

const ADMIN_HOSTNAME = process.env.ADMIN_HOSTNAME || 'adminpos.chambudigital.co.ke'

const AUTH_PASSTHROUGH = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/staff-login',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // ── Admin route protection ────────────────────────────────────────────────
  // In production, only allow /admin routes from the designated admin hostname.
  // In development (localhost), always allow.
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1')
    const isAdminHost = hostname === ADMIN_HOSTNAME

    if (!isLocalhost && !isAdminHost) {
      // Redirect to home — don't reveal the admin exists
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // On the admin subdomain, redirect root to /admin/login
  if (hostname === ADMIN_HOSTNAME && pathname === '/') {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  // Pass through static assets
  if (pathname.startsWith('/_next')) return NextResponse.next()

  // Pass through non-API routes and auth endpoints
  if (!pathname.startsWith('/api/')) return NextResponse.next()
  if (AUTH_PASSTHROUGH.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/api/demo/')) return NextResponse.next()

  // ── Demo mode interception ────────────────────────────────────────────────
  const token = request.cookies.get('auth_token')?.value
  if (!token) return NextResponse.next()

  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.isDemo !== true) return NextResponse.next()
  } catch {
    return NextResponse.next()
  }

  const method = request.method
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    const fakeId = `demo_${Date.now()}`
    const now = new Date().toISOString()
    let body: any = { success: true, _demo: true }

    if (pathname.includes('/rentals'))       body.rental  = { _id: fakeId, customer: { name: 'Demo Customer', phone: '0700000000' }, items: [], startTime: now, deposit: 0, status: 'active', createdAt: now }
    else if (pathname.includes('/sales'))    body.sale    = { _id: fakeId, createdAt: now }
    else if (pathname.includes('/products')) body.product = { _id: fakeId }
    else if (pathname.includes('/staff'))    body.staff   = { _id: fakeId }

    return NextResponse.json(body, { status: method === 'POST' ? 201 : 200 })
  }

  const rest = pathname.replace('/api/', '')
  const demoUrl = request.nextUrl.clone()
  demoUrl.pathname = `/api/demo/${rest}`
  return NextResponse.rewrite(demoUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
