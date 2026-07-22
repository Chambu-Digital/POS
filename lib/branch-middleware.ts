// ─── Branch-based Access Control Middleware ───────────────────────────────────
// Helper functions to enforce branch scoping in API routes

import { getAuthPayload } from '@/lib/jwt'
import { NextResponse } from 'next/server'

export interface BranchContext {
  userId: string
  branchId: string | null
  hasBranch: boolean
}

/**
 * Get the branch context from the current auth payload
 * Returns userId and branchId (if selected)
 */
export async function getBranchContext(): Promise<BranchContext> {
  const payload = await getAuthPayload()
  if (!payload) {
    throw new Error('Unauthorized')
  }

  const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

  return {
    userId: ownerId,
    branchId: payload.branchId || null,
    hasBranch: !!payload.branchId,
  }
}

/**
 * Require a branch to be selected. Returns 400 if no branch is selected.
 */
export async function requireBranch(): Promise<BranchContext> {
  const context = await getBranchContext()
  
  if (!context.branchId) {
    throw new Error('Branch selection required. Please select a branch.')
  }
  
  return context
}

/**
 * Build a MongoDB query with branch filtering
 * If branchId is present, adds branchId to the query
 * If branchId is not present, returns query without branch filter (for global resources)
 */
export function buildBranchQuery(baseQuery: any, branchId: string | null): any {
  if (branchId) {
    return { ...baseQuery, branchId }
  }
  return baseQuery
}

/**
 * Validate that a resource belongs to the user's selected branch
 * Throws error if resource doesn't match the branch
 */
export function validateBranchAccess(resourceBranchId: string, userBranchId: string): void {
  if (resourceBranchId !== userBranchId) {
    throw new Error('Access denied: Resource does not belong to selected branch')
  }
}

/**
 * Middleware wrapper for API routes that require branch context
 * Usage: const context = await withBranchContext()
 */
export async function withBranchContext(): Promise<BranchContext> {
  try {
    return await getBranchContext()
  } catch (error) {
    throw new Error('Unauthorized')
  }
}

/**
 * Middleware wrapper for API routes that require a selected branch
 * Usage: const context = await withRequiredBranch()
 */
export async function withRequiredBranch(): Promise<BranchContext> {
  try {
    return await requireBranch()
  } catch (error: any) {
    if (error.message === 'Branch selection required. Please select a branch.') {
      throw new Error('BRANCH_REQUIRED')
    }
    throw new Error('Unauthorized')
  }
}
