// ─── Branch Context Helper ────────────────────────────────────────────────────
// Determines the current branch context for multi-branch operations
// - Staff: returns their assigned branchId from JWT
// - Owners: returns selected branch from X-Branch-Context header or cookie

import { getAuthPayload } from '@/lib/jwt'
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function getBranchContext(request: NextRequest): Promise<string | null> {
  const payload = await getAuthPayload()
  if (!payload) return null

  // Staff users: use their assigned branch from JWT
  if (payload.type === 'staff' && payload.branchId) {
    return payload.branchId
  }

  // Owner users: check header first, then cookie
  if (payload.type === 'user') {
    // Check X-Branch-Context header
    const headerBranch = request.headers.get('X-Branch-Context')
    if (headerBranch) return headerBranch

    // Check cookie as fallback
    const cookieStore = await cookies()
    const cookieBranch = cookieStore.get('selected_branch')?.value
    if (cookieBranch) return cookieBranch
  }

  return null
}

export async function setBranchCookie(branchId: string) {
  const cookieStore = await cookies()
  cookieStore.set('selected_branch', branchId, {
    httpOnly: false,  // Allow client-side access
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,  // 30 days
  })
}

export async function clearBranchCookie() {
  const cookieStore = await cookies()
  cookieStore.delete('selected_branch')
}
