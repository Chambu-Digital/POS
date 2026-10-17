/**
 * Email Index Management
 * Fast email-to-tenant lookup for optimized login performance
 */

import { getAdminModels } from './admin-models'

export interface EmailIndexEntry {
  email: string
  tenantId: any
  userType: 'user' | 'staff'
  userId: string
  isActive: boolean
}

/**
 * Find which tenant(s) a user belongs to by email
 * Returns all matches (should typically be 1, but could be multiple if user is staff in multiple tenants)
 */
export async function findUserByEmail(email: string): Promise<EmailIndexEntry[]> {
  const { UserEmailIndex } = await getAdminModels()
  
  const entries = await UserEmailIndex.find({
    email: email.toLowerCase(),
    isActive: true
  }).lean()
  
  return entries as EmailIndexEntry[]
}

/**
 * Add or update an email index entry
 * Called when creating new users or staff
 */
export async function upsertEmailIndex(params: {
  email: string
  tenantId: any
  userType: 'user' | 'staff'
  userId: string
  isActive?: boolean
}) {
  const { UserEmailIndex } = await getAdminModels()
  
  await UserEmailIndex.findOneAndUpdate(
    {
      email: params.email.toLowerCase(),
      tenantId: params.tenantId,
      userType: params.userType,
    },
    {
      email: params.email.toLowerCase(),
      tenantId: params.tenantId,
      userType: params.userType,
      userId: params.userId,
      isActive: params.isActive ?? true,
      lastSync: new Date(),
    },
    { upsert: true, new: true }
  )
}

/**
 * Remove an email index entry
 * Called when deleting users or staff, or when deactivating staff
 */
export async function removeEmailIndex(params: {
  email: string
  tenantId: any
  userType: 'user' | 'staff'
}) {
  const { UserEmailIndex } = await getAdminModels()
  
  await UserEmailIndex.deleteOne({
    email: params.email.toLowerCase(),
    tenantId: params.tenantId,
    userType: params.userType,
  })
}

/**
 * Mark an email index entry as inactive (soft delete)
 * Used when deactivating staff accounts
 */
export async function deactivateEmailIndex(params: {
  email: string
  tenantId: any
  userType: 'user' | 'staff'
}) {
  const { UserEmailIndex } = await getAdminModels()
  
  await UserEmailIndex.updateOne(
    {
      email: params.email.toLowerCase(),
      tenantId: params.tenantId,
      userType: params.userType,
    },
    {
      isActive: false,
      lastSync: new Date(),
    }
  )
}

/**
 * Reactivate an email index entry
 * Used when reactivating staff accounts
 */
export async function activateEmailIndex(params: {
  email: string
  tenantId: any
  userType: 'user' | 'staff'
}) {
  const { UserEmailIndex } = await getAdminModels()
  
  await UserEmailIndex.updateOne(
    {
      email: params.email.toLowerCase(),
      tenantId: params.tenantId,
      userType: params.userType,
    },
    {
      isActive: true,
      lastSync: new Date(),
    }
  )
}
