// Permission checking utilities

export interface Permissions {
  canMakeSales: boolean
  canViewOrders: boolean
  canViewInventory: boolean
  canEditInventory: boolean
  canAddProducts: boolean
  canDeleteProducts: boolean
  canViewSalesReports: boolean
  canViewDashboard: boolean
  canManageStaff: boolean
  canEditSettings: boolean
  canProcessRefunds: boolean
  canApplyDiscounts: boolean
  canDeleteOrders: boolean
  canExportData: boolean
}

// Default permissions by role
export const rolePermissions: Record<string, Partial<Permissions>> = {
  manager: {
    canMakeSales: true,
    canViewOrders: true,
    canViewInventory: true,
    canEditInventory: true,
    canAddProducts: true,
    canDeleteProducts: true,
    canViewSalesReports: true,
    canViewDashboard: true,
    canManageStaff: true,
    canEditSettings: false,
    canProcessRefunds: true,
    canApplyDiscounts: true,
    canDeleteOrders: true,
    canExportData: true,
  },
  supervisor: {
    canMakeSales: true,
    canViewOrders: true,
    canViewInventory: true,
    canEditInventory: true,
    canAddProducts: true,
    canDeleteProducts: false,
    canViewSalesReports: true,
    canViewDashboard: true,
    canManageStaff: false,
    canEditSettings: false,
    canProcessRefunds: true,
    canApplyDiscounts: true,
    canDeleteOrders: false,
    canExportData: false,
  },
  cashier: {
    canMakeSales: true,
    canViewOrders: true,
    canViewInventory: true,
    canEditInventory: false,
    canAddProducts: false,
    canDeleteProducts: false,
    canViewSalesReports: false,
    canViewDashboard: true,
    canManageStaff: false,
    canEditSettings: false,
    canProcessRefunds: false,
    canApplyDiscounts: true,
    canDeleteOrders: false,
    canExportData: false,
  },
  employee: {
    canMakeSales: true,
    canViewOrders: false,
    canViewInventory: true,
    canEditInventory: false,
    canAddProducts: false,
    canDeleteProducts: false,
    canViewSalesReports: false,
    canViewDashboard: true,
    canManageStaff: false,
    canEditSettings: false,
    canProcessRefunds: false,
    canApplyDiscounts: false,
    canDeleteOrders: false,
    canExportData: false,
  },
}

// Check if user has specific permission
export function hasPermission(
  permissions: Partial<Permissions> | undefined,
  permission: keyof Permissions
): boolean {
  if (!permissions) return false
  return permissions[permission] === true
}

// Check if user has any of the specified permissions
export function hasAnyPermission(
  permissions: Partial<Permissions> | undefined,
  requiredPermissions: (keyof Permissions)[]
): boolean {
  if (!permissions) return false
  return requiredPermissions.some((perm) => permissions[perm] === true)
}

// Check if user has all of the specified permissions
export function hasAllPermissions(
  permissions: Partial<Permissions> | undefined,
  requiredPermissions: (keyof Permissions)[]
): boolean {
  if (!permissions) return false
  return requiredPermissions.every((perm) => permissions[perm] === true)
}

// Get permissions for a role
export function getPermissionsForRole(role: string): Partial<Permissions> {
  return rolePermissions[role] || rolePermissions.employee
}
