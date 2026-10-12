// ─── Branch Validation Helper ────────────────────────────────────────────────────
// Validates branch status and access for operations

import { Types } from 'mongoose'

export interface BranchModel {
  _id: string | Types.ObjectId
  userId: string | Types.ObjectId
  status: 'active' | 'inactive' | 'closed'
  isDefault: boolean
  name: string
}

/**
 * Validates that a branch exists and is active
 * Throws error with descriptive message if not
 */
export function validateBranchActive(branch: BranchModel | null, operation: string): asserts branch is BranchModel {
  if (!branch) {
    throw new Error('Branch not found')
  }

  if (branch.status !== 'active') {
    throw new Error(`Cannot ${operation} on a ${branch.status} branch (${branch.name})`)
  }
}

/**
 * Validates that a branch exists
 * Throws error if not
 */
export function validateBranchExists(branch: BranchModel | null): asserts branch is BranchModel {
  if (!branch) {
    throw new Error('Branch not found')
  }
}

/**
 * Validates that multiple branches exist and are active
 * Throws error with which branch is problematic
 */
export function validateBranchesActive(branches: Map<string | Types.ObjectId, BranchModel | null>, operation: string): void {
  for (const [branchId, branch] of branches) {
    if (!branch) {
      throw new Error(`Branch ${branchId} not found`)
    }
    if (branch.status !== 'active') {
      throw new Error(`Cannot ${operation} on inactive branch: ${branch.name} (${branch.status})`)
    }
  }
}

/**
 * Build a query that filters for active branches
 */
export function activeOnlyQuery(baseQuery: any): any {
  return {
    ...baseQuery,
    status: 'active',
  }
}
