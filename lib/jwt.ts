import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface TokenPayload {
  userId: string
  email: string
  role: string
  type: 'user' | 'staff'
  adminId?: string // For staff members, this is the owner's userId
  isDemo?: boolean
}

export async function createToken(payload: TokenPayload): Promise<string> {
  return jwt.sign(payload, secret, {
    expiresIn: '7d',
  })
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const decoded = jwt.verify(token, secret)
    return decoded as TokenPayload
  } catch {
    return null
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  })
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get('auth_token')?.value
}

export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
}

export async function getAuthPayload(): Promise<TokenPayload | null> {
  const token = await getAuthCookie()
  if (!token) return null
  return verifyToken(token)
}
