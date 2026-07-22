import { getAdminModels } from '@/lib/admin-models'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'

/**
 * Check if an email exists across all active tenants
 * Returns the tenant ID and user type if found, null otherwise
 */
export async function checkEmailExistsAcrossTenants(
  email: string
): Promise<{ tenantId: string; userType: 'user' | 'staff' } | null> {
  const { Tenant } = await getAdminModels()
  const tenants = await Tenant.find({ isActive: true }).lean() as unknown as Array<{
    _id: any
    mongoUri: string
    features: Record<string, boolean>
    shopName: string
  }>

  for (const tenant of tenants) {
    try {
      const conn = await connectTenantDB(tenant.mongoUri)
      const models = getModels(conn)

      // Check for owner
      const user = await models.User.findOne({ email })
      if (user) {
        return { tenantId: tenant._id.toString(), userType: 'user' }
      }

      // Check for staff
      const staff = await models.Staff.findOne({ email, active: true })
      if (staff) {
        return { tenantId: tenant._id.toString(), userType: 'staff' }
      }
    } catch (err) {
      console.error('[checkEmailExistsAcrossTenants] Error checking tenant:', tenant.mongoUri, err)
      continue
    }
  }

  return null
}

/**
 * Check if an email exists in a specific tenant
 */
export async function checkEmailExistsInTenant(
  email: string,
  mongoUri: string
): Promise<{ userType: 'user' | 'staff' } | null> {
  try {
    const conn = await connectTenantDB(mongoUri)
    const models = getModels(conn)

    // Check for owner
    const user = await models.User.findOne({ email })
    if (user) {
      return { userType: 'user' }
    }

    // Check for staff
    const staff = await models.Staff.findOne({ email, active: true })
    if (staff) {
      return { userType: 'staff' }
    }

    return null
  } catch (err) {
    console.error('[checkEmailExistsInTenant] Error:', err)
    return null
  }
}
