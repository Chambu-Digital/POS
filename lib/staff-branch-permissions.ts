// ─── Staff Branch Permissions Helper ──────────────────────────────────────────
// Clarifies and enforces staff permissions across branches
//
// STAFF ROLE MODEL:
// - branchId: Primary branch assignment. Staff works primarily in this branch.
// - managerOfBranches: Array of branch IDs where staff has manager-level permissions.
// - isBranchManager (derived): True if managerOfBranches is non-empty.
//
// PERMISSION LEVELS:
// 1. Staff (empty managerOfBranches): 
//    - Can only see/operate in their assigned branchId
//    - Cannot approve transfers, manage staff, or access cross-branch reports
//
// 2. Branch Manager (isBranchManager=true, managerOfBranches includes branchId+others):
//    - Can see/operate in branchId AND all managerOfBranches
//    - Can approve stock transfers for managed branches
//    - Can manage staff in managed branches
//    - Can view reports for managed branches
//
// 3. Admin/Owner (payload.type='user'):
//    - Can see/operate across all branches
//    - Can manage all staff and transfers

import { Types } from 'mongoose'
import { getAuthPayload } from '@/lib/jwt'

export interface StaffModel {
  _id: string | Types.ObjectId
  userId: string | Types.ObjectId
  branchId: string | Types.ObjectId
  managerOfBranches: (string | Types.ObjectId)[]
  active: boolean
}

export interface PermissionContext {
  isOwner: boolean
  isBranchManager: boolean
  primaryBranchId: string | Types.ObjectId
  accessibleBranchIds: (string | Types.ObjectId)[]
  canViewAllBranches: boolean
}

/**
 * Get permission context for a staff member
 * Works with both JWT token and DB staff model
 * - If managerOfBranches is empty: can only access primaryBranchId
 * - If managerOfBranches is non-empty: can access primaryBranchId + all managerOfBranches
 */
export function getStaffPermissionContext(staff: StaffModel | { isBranchManager?: boolean; managerOfBranches?: string[]; branchId?: string }): PermissionContext {
  const isBranchManager = !!(staff as any).isBranchManager
  const managerOfBranches = (staff as any).managerOfBranches || []
  const branchId = (staff as any).branchId
  
  let accessibleBranchIds: (string | Types.ObjectId)[] = []
  
  if (branchId) {
    accessibleBranchIds = [branchId]
  }
  
  if (isBranchManager && managerOfBranches.length > 0) {
    // Add manager branches (avoid duplicates)
    const branchIdSet = new Set([
      branchId?.toString(),
      ...managerOfBranches.map(b => (typeof b === 'string' ? b : b.toString())),
    ].filter(Boolean))
    accessibleBranchIds = Array.from(branchIdSet).map(id => new Types.ObjectId(id))
  }

  return {
    isOwner: false,
    isBranchManager,
    primaryBranchId: branchId || '',
    accessibleBranchIds,
    canViewAllBranches: false,
  }
}

/**
 * Check if staff can perform operation on a branch
 * Returns true if:
 * - Staff's primaryBranchId matches, OR
 * - Staff is a manager and branch is in managerOfBranches
 */
export function canAccessBranch(
  staff: StaffModel | { isBranchManager?: boolean; managerOfBranches?: string[]; branchId?: string },
  targetBranchId: string | Types.ObjectId
): boolean {
  const context = getStaffPermissionContext(staff)
  return context.accessibleBranchIds.some(
    bid => bid.toString() === targetBranchId.toString()
  )
}

/**
 * Validate staff can perform operation on target branch
 * Throws error if access denied
 */
export function validateBranchAccess(
  staff: StaffModel | { isBranchManager?: boolean; managerOfBranches?: string[]; branchId?: string },
  targetBranchId: string | Types.ObjectId,
  operation: string
): void {
  if (!canAccessBranch(staff, targetBranchId)) {
    throw new Error(
      `Cannot ${operation}: Branch access denied. Staff is only assigned to ${
        (staff as any).isBranchManager ? 'branches' : 'branch'
      } they manage.`
    )
  }
}

/**
 * Check if staff can approve/receive transfers
 * Only staff with isBranchManager flag (derived from managerOfBranches) can approve
 */
export function canApproveTransfer(staff: StaffModel | { isBranchManager?: boolean }): boolean {
  return !!(staff as any).isBranchManager
}

/**
 * Check if staff can manage staff in a branch
 * Only staff with isBranchManager flag can manage staff
 */
export function canManageStaff(staff: StaffModel | { isBranchManager?: boolean }): boolean {
  return !!(staff as any).isBranchManager
}

/**
 * Check if staff can create transfers from their branch
 * Any active staff can create transfers
 */
export function canCreateTransfer(staff: StaffModel | { active?: boolean }): boolean {
  return !!(staff as any).active
}

/**
 * Build query filter for staff data visibility
 * Staff should only see data from branches they have access to
 */
export function buildStaffAccessQuery(staff: StaffModel | { isBranchManager?: boolean; managerOfBranches?: string[]; branchId?: string }, baseQuery: any = {}): any {
  const context = getStaffPermissionContext(staff)
  return {
    ...baseQuery,
    branchId: { $in: context.accessibleBranchIds },
  }
}

/**
 * Create permission context from JWT token (for API routes)
 * Faster than fetching staff from DB, uses pre-encoded JWT fields
 */
export async function getPermissionContextFromToken(): Promise<PermissionContext | null> {
  const payload = await getAuthPayload()
  if (!payload || payload.type !== 'staff') return null

  return getStaffPermissionContext({
    isBranchManager: payload.isBranchManager,
    managerOfBranches: payload.managerOfBranches,
    branchId: payload.branchId,
  })
}
