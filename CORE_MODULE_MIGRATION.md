# Core Module Implementation - Migration Guide

## Overview

This document describes the implementation of the Core Module system, which separates essential business resources (Customers, Suppliers, Staff, Settings) from optional business modules (Retail, Service, Rentals, Pharmacy).

## What Changed

### 1. New Core Module

Created a new `CORE_MODULE` in `lib/modules.ts` containing:

- **core.customers** → Customer management (formerly `pos.customers`)
- **core.suppliers** → Supplier management (formerly `pos.suppliers`)
- **core.staff** → Staff management (formerly admin-only feature)
- **core.settings** → Business settings (formerly `pos.settings`)

### 2. Key Characteristics

- **Always enabled by default** (`defaultOn: true`)
- **Available to all business modules** (not specific to Retail/Service)
- **Backward compatible** via `LEGACY_KEY_MAP`
- **Visually distinct** (blue styling vs green for business modules)

## File Structure Changes

### Routes Moved

```
Before:                              After:
/dashboard/retail/customers      →   /dashboard/customers
/dashboard/retail/suppliers      →   /dashboard/suppliers
/dashboard/staff                     (no change)
/dashboard/settings                  (no change)
```

**Backward compatibility:** Re-export stubs created at old retail locations.

### Permission Keys Changed

```
Before:               After:
pos.customers     →   core.customers
pos.suppliers     →   core.suppliers
pos.settings      →   core.settings
bar.customers     →   core.customers
```

## Code Changes

### 1. lib/modules.ts

**Added:**
- `CORE_MODULE` definition
- Core feature keys to `LEGACY_KEY_MAP`
- Updated `DEFAULT_STAFF_PERMISSIONS` to use `core.*` keys
- Updated `DEFAULT_MANAGER_PERMISSIONS` to use `core.*` keys
- Updated `normalisePermissions()` to apply `LEGACY_KEY_MAP`

**Module Order:**
```typescript
export const MODULES = [
  CORE_MODULE,      // New: always first
  RETAIL_MODULE,
  SERVICE_MODULE,
  RENTALS_MODULE,
  PHARMACY_MODULE,
]
```

### 2. components/dashboard/sidebar.tsx

**Changes:**
- Removed `STATIC_BOTTOM` (Staff and Settings)
- Added `renderCoreFeatures()` function
- Core features render as flat items between Dashboard and business modules
- Added legacy path mappings for customers and suppliers

**Render Order:**
```
Dashboard
↓
[Business Modules with collapsible groups]
↓ (separator line)
Customers      }
Suppliers      } Core features (flat, at bottom)
Staff          }
Settings       }
```

### 3. app/admin/tenants/_form.tsx

**Changes:**
- Core module renders with blue styling
- Shows "ESSENTIAL" badge
- Toggle disabled to keep always on
- Warning message when expanding core features
- Renders before business modules

### 4. app/dashboard/staff/page.tsx

**Changes:**
- Permission modal shows "Core Resources" section separately
- Blue styling and "ESSENTIAL" badge for core section
- Admin-only core features (staff, settings) filtered out
- Core section appears above business modules

### 5. Permission Guards Updated

**Files changed:**
- `app/dashboard/customers/page.tsx`: `pos.customers` → `core.customers`
- `app/dashboard/suppliers/page.tsx`: `pos.suppliers` → `core.suppliers`
- `app/dashboard/suppliers/[id]/page.tsx`: `pos.suppliers` → `core.suppliers`

## Database Migration

### Running the Migration

```bash
npx tsx scripts/migrate-core-features.ts
```

### What It Does

**Tenant Features (Admin DB):**
- Finds all tenants with old feature keys
- Replaces `pos.customers` → `core.customers`
- Replaces `pos.suppliers` → `core.suppliers`
- Replaces `pos.settings` → `core.settings`
- Replaces `bar.customers` → `core.customers`
- Removes old keys

**Staff Permissions (Each Tenant DB):**
- Connects to each tenant database
- Finds all staff with old permission keys
- Applies same key replacements
- Removes old keys

### Safety

- ✅ Safe to run multiple times
- ✅ Skips already-migrated records
- ✅ Shows detailed progress logs
- ✅ Backward compatibility maintained even without migration

## Backward Compatibility

### Without Migration

The system works with old keys through `LEGACY_KEY_MAP`:

```typescript
export const LEGACY_KEY_MAP = {
  'pos.customers': 'core.customers',
  'pos.suppliers': 'core.suppliers',
  'pos.settings':  'core.settings',
  'bar.customers': 'core.customers',
}
```

Both `normaliseFeatures()` and `normalisePermissions()` apply this mapping automatically.

### With Migration

After migration:
- Database records use new keys directly
- Cleaner data structure
- No mapping overhead
- Future-proof

## Testing Checklist

### Admin Panel

- [ ] Create new tenant → Core features show with "ESSENTIAL" badge
- [ ] Core features are ON by default
- [ ] Core toggle disabled (always on)
- [ ] Expanding core section shows warning
- [ ] Edit existing tenant → Shows current core feature state

### Sidebar (Business Owner)

- [ ] Dashboard appears first
- [ ] Core features appear as flat items (Customers, Suppliers, Staff, Settings)
- [ ] Business modules appear below with collapsible groups
- [ ] All links work correctly
- [ ] Active states highlight correctly

### Sidebar (Staff)

- [ ] Staff without `core.customers` permission don't see Customers link
- [ ] Staff without `core.suppliers` permission don't see Suppliers link
- [ ] Staff never see Staff or Settings (adminOnly)
- [ ] Staff with permissions see appropriate core links

### Permission Modal

- [ ] "Core Resources" section appears at top with blue styling
- [ ] "ESSENTIAL" badge shows
- [ ] `core.customers` and `core.suppliers` are toggleable
- [ ] `core.staff` and `core.settings` hidden (adminOnly)
- [ ] Business modules appear below core section
- [ ] Saving updates correctly

### Backward Compatibility

- [ ] Old URLs redirect: `/dashboard/retail/customers` → `/dashboard/customers`
- [ ] Old URLs redirect: `/dashboard/retail/suppliers` → `/dashboard/suppliers`
- [ ] Existing tenants with old feature keys work correctly
- [ ] Existing staff with old permission keys work correctly
- [ ] Feature checks work with both old and new keys

### Pages & Permissions

- [ ] `/dashboard/customers` requires `core.customers` permission
- [ ] `/dashboard/suppliers` requires `core.suppliers` permission
- [ ] `/dashboard/suppliers/[id]` requires `core.suppliers` permission
- [ ] `/dashboard/staff` is admin-only (no feature check)
- [ ] `/dashboard/settings` is admin-only (no feature check)

## Migration Status

### ✅ Completed

1. Core module definition and structure
2. Feature key migrations in `LEGACY_KEY_MAP`
3. Route migrations (suppliers, customers)
4. Permission guard updates
5. Sidebar navigation updates
6. Admin tenant form updates
7. Staff permission modal updates
8. Default permission updates
9. Migration script creation

### 🎯 Ready for Production

All code changes are backward compatible. The migration script is optional but recommended for data cleanliness.

## Rollback Plan

If issues arise:

1. **Code rollback:** Git revert to previous commit
2. **Database rollback:** Restore from backup (if migration was run)
3. **Partial rollback:** Keep new code, don't run migration (old keys still work)

## Support

For questions or issues:
- Check `LEGACY_KEY_MAP` in `lib/modules.ts`
- Review `normaliseFeatures()` and `normalisePermissions()` functions
- Check migration logs: `scripts/migrate-core-features.ts`
