# Core Module - Quick Reference

## Feature Keys

### Core Features (Always Available)
```typescript
'core.customers'  // Customer management
'core.suppliers'  // Supplier management  
'core.staff'      // Staff management (admin-only)
'core.settings'   // Business settings (admin-only)
```

### Business Module Features
```typescript
// Retail
'pos.sales', 'pos.orders', 'pos.inventory', 'pos.stock-movements',
'pos.reports', 'pos.expenses'

// Service → Kitchen
'kds.orders', 'kds.chef', 'kds.waiter', 'kds.history', 
'kds.menu', 'kds.inventory'

// Service → Bar
'bar.tabs', 'bar.inventory', 'bar.reports', 'bar.admin'

// Rentals
'rentals.bookings', 'rentals.manage'

// Pharmacy
'pharmacy.pos', 'pharmacy.inventory', 'pharmacy.patients',
'pharmacy.appointments', 'pharmacy.billing'
```

## Routes

### Core Routes
```
/dashboard/customers      (core.customers)
/dashboard/suppliers      (core.suppliers)
/dashboard/staff          (admin-only, no feature key)
/dashboard/settings       (admin-only, no feature key)
```

### Legacy Routes (Still Work)
```
/dashboard/retail/customers  → redirects to /dashboard/customers
/dashboard/retail/suppliers  → redirects to /dashboard/suppliers
```

## Permission Checks

### Using PermissionGuard
```tsx
import { PermissionGuard } from '@/components/auth/permission-guard'

// Core features
<PermissionGuard requiredPermission="core.customers">
  <CustomersContent />
</PermissionGuard>

<PermissionGuard requiredPermission="core.suppliers">
  <SuppliersContent />
</PermissionGuard>

// Business module features
<PermissionGuard requiredPermission="pos.sales">
  <SalesContent />
</PermissionGuard>
```

### Programmatic Checks
```typescript
import { useUser } from '@/hooks/use-user'

function MyComponent() {
  const { user, hasPermission } = useUser()
  
  const canSeeCustomers = hasPermission('core.customers')
  const canSeeSuppliers = hasPermission('core.suppliers')
  
  if (user?.type === 'user') {
    // Business owners see everything
  } else if (user?.type === 'staff') {
    // Staff see only what they have permission for
  }
}
```

## Module Configuration

### In lib/modules.ts
```typescript
export const CORE_MODULE: ModuleDefinition = {
  key: 'core',
  label: 'Core',
  description: 'Essential business resources',
  defaultOn: true,  // Always enabled
  features: [
    {
      key: 'core.customers',
      label: 'Customers',
      href: '/dashboard/customers',
      adminOnly: false,  // Staff can access with permission
      defaultOn: true,
    },
    // ... other core features
  ],
}
```

### Module Order Matters
```typescript
export const MODULES = [
  CORE_MODULE,      // First: essential resources
  RETAIL_MODULE,    // Then: business modules
  SERVICE_MODULE,
  RENTALS_MODULE,
  PHARMACY_MODULE,
]
```

## Backward Compatibility

### Legacy Key Mapping
```typescript
// Old keys automatically map to new keys
const LEGACY_KEY_MAP = {
  'pos.customers': 'core.customers',
  'pos.suppliers': 'core.suppliers',
  'pos.settings':  'core.settings',
  'bar.customers': 'core.customers',
}
```

### No Code Changes Needed
Existing code using old keys continues to work:
- Feature checks with `pos.customers` → automatically treated as `core.customers`
- Permission checks with `pos.suppliers` → automatically treated as `core.suppliers`
- Database records with old keys → normalized on read

## Adding New Core Features

1. Add to `CORE_MODULE.features` in `lib/modules.ts`
2. Create route at `/dashboard/[feature-name]`
3. Add permission guard using `core.[feature-name]`
4. Update `DEFAULT_STAFF_PERMISSIONS` if needed
5. Add to sidebar via `renderCoreFeatures()`

## Common Patterns

### Feature-Gated UI
```tsx
function Dashboard() {
  const { features } = useTenant()
  
  return (
    <>
      {features['core.customers'] && <CustomersWidget />}
      {features['core.suppliers'] && <SuppliersWidget />}
      {features['pos.sales'] && <SalesWidget />}
    </>
  )
}
```

### Staff Permission Check
```tsx
function StaffDashboard() {
  const { user } = useUser()
  const permissions = user?.permissions || {}
  
  return (
    <>
      {permissions['core.customers'] && <Link href="/dashboard/customers">Customers</Link>}
      {permissions['core.suppliers'] && <Link href="/dashboard/suppliers">Suppliers</Link>}
      {permissions['pos.sales'] && <Link href="/dashboard/retail/sales">Sales</Link>}
    </>
  )
}
```

### Admin vs Staff Rendering
```tsx
function Sidebar() {
  const { user } = useUser()
  const isAdmin = user?.type === 'user'
  const isStaff = user?.type === 'staff'
  
  return (
    <>
      {/* Dashboard */}
      <NavItem href="/dashboard" />
      
      {/* Business modules (collapsible groups) */}
      <ModuleGroup module={RETAIL_MODULE} />
      <ModuleGroup module={SERVICE_MODULE} />
      
      {/* Separator */}
      <Separator />
      
      {/* Core features at bottom - flat items */}
      <NavItem href="/dashboard/customers" permission="core.customers" />
      <NavItem href="/dashboard/suppliers" permission="core.suppliers" />
      
      {/* Admin-only core features */}
      {isAdmin && (
        <>
          <NavItem href="/dashboard/staff" />
          <NavItem href="/dashboard/settings" />
        </>
      )}
    </>
  )
}
```

## Visual Styling

### Core Module Colors
- Border: `border-blue-400`
- Background: `bg-blue-50/30` or `bg-blue-100`
- Text: `text-blue-800` or `text-blue-700`
- Badge: Blue with "ESSENTIAL" text

### Business Module Colors
- Border: `border-green-400`
- Background: `bg-green-50/40` or `bg-green-100`
- Text: `text-green-800`
- Standard toggle colors

## Troubleshooting

### Staff can't see customers/suppliers
- Check permission in database: `staff.permissions['core.customers']`
- Verify feature enabled: `tenant.features['core.customers']`
- Check PermissionGuard on page component

### Old URLs not working
- Verify re-export exists at old location
- Check `LEGACY_ACTIVE_MAP` in sidebar for active state highlighting
- Ensure Next.js build is up to date

### Migration not applying
- Check `LEGACY_KEY_MAP` includes all old keys
- Verify `normaliseFeatures()` and `normalisePermissions()` are being called
- Run migration script: `npx tsx scripts/migrate-core-features.ts`

### Feature appears in wrong section
- Check module definition order in `MODULES` array
- Verify `mod.key === 'core'` check in render functions
- Ensure feature key starts with `core.`
