// ─── Branch Context Helper ────────────────────────────────────────────────────
// Determines the current branch context for multi-branch operations
// - Staff: returns their assigned branchId from JWT
// - Owners: returns selected branch from header/cookie with fallback to default branch

import { getAuthPayload } from '@/lib/jwt'
import { getTenantDB } from '@/lib/tenant/get-db'
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Get branch context with intelligent fallback
 * 1. For staff: returns assigned branchId from JWT
 * 2. For owners: tries header → cookie → default branch (validates each is still active)
 * Returns null only if user has no branches at all
 */
export async function getBranchContext(request: NextRequest): Promise<string | null> {
  const payload = await getAuthPayload()
  if (!payload) return null

  // Staff users: use their assigned branch from JWT
  if (payload.type === 'staff' && payload.branchId) {
    return payload.branchId
  }

  // Owner users: intelligent fallback chain
  if (payload.type === 'user') {
    const { models } = await getTenantDB(request)

    // 1. Try X-Branch-Context header first (explicit selection)
    const headerBranch = request.headers.get('X-Branch-Context')
    if (headerBranch) {
      const branch = await models.Branch.findOne({
        _id: headerBranch,
        userId: payload.userId,
        status: 'active', // Only use active branches
      })
      if (branch) return headerBranch
      // Header branch is deleted or inactive - fall through
    }

    // 2. Try cookie (persistent selection)
    const cookieStore = await cookies()
    const cookieBranch = cookieStore.get('selected_branch')?.value
    if (cookieBranch) {
      const branch = await models.Branch.findOne({
        _id: cookieBranch,
        userId: payload.userId,
        status: 'active',
      })
      if (branch) return cookieBranch
      // Cookie branch is deleted or inactive - clear cookie and fall through
      clearBranchCookie()
    }

    // 3. Fall back to default branch (last resort)
    const defaultBranch = await models.Branch.findOne({
      userId: payload.userId,
      isDefault: true,
      status: 'active',
    })
    if (defaultBranch) {
      // Update cookie to default for next request
      setBranchCookie(defaultBranch._id.toString())
      return defaultBranch._id.toString()
    }

    // 4. If no default, return any active branch
    const anyBranch = await models.Branch.findOne({
      userId: payload.userId,
      status: 'active',
    }).sort({ createdAt: 1 })
    if (anyBranch) {
      setBranchCookie(anyBranch._id.toString())
      return anyBranch._id.toString()
    }
  }

  return null
}

/**
 * Get branch context synchronously (for non-async contexts)
 * Limited fallback - only checks header and cookie
 * Use getBranchContext() for full fallback chain
 */
export async function getBranchContextSync(request: NextRequest): Promise<string | null> {
  const payload = await getAuthPayload()
  if (!payload) return null

  if (payload.type === 'staff' && payload.branchId) {
    return payload.branchId
  }

  if (payload.type === 'user') {
    // Check header
    const headerBranch = request.headers.get('X-Branch-Context')
    if (headerBranch) return headerBranch

    // Check cookie
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
