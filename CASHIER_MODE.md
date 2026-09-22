# Cashier Mode - Offline-First Implementation

## Overview

Cashier mode is a specialized authentication mode designed for cashiers to work seamlessly offline without permission checks that could break the cache and disrupt operations.

## How It Works

### 1. Login Detection

When a staff member logs in via `/api/auth/staff-login`:
- If `role === 'cashier'`, cashier mode is activated
- JWT token includes:
  - `isCashierMode: true`
  - `allowedRoutes: [...]` - Static list of allowed routes
  - `permissions: {...}` - Static cashier permissions (not customizable)

### 2. Route Access

**Cashier Allowed Routes:**
- `/dashboard`
- `/dashboard/sales`
- `/dashboard/retail/sales`
- `/dashboard/customers`
- `/dashboard/retail/customers`

Cashiers only see these routes in the sidebar - no other navigation options appear.

### 3. Permission Handling

**Traditional Staff (Manager/Supervisor):**
- Each feature checked against `permissions['feature.key']`
- Can be customized per-staff member
- Permission denied → redirect (breaks cache)

**Cashier Mode:**
- NO permission checks on client-side
- Routes filtered by `allowedRoutes` array at login
- If route not in array, it's not rendered in sidebar
- No redirects = no cache breaks = offline works

### 4. Service Worker Caching

**Cashier Routes (Cache-First):**
```javascript
// Instant load from cache, update in background
if (isCashierRoute) {
  return cached || fetch().then(cache).catch(fallback)
}
```

**Non-Cashier Routes (Network-First):**
```javascript
// Standard behavior - fetch first, cache fallback
return fetch().catch(() => cached)
```

**Cashier-Critical APIs (Aggressive Caching):**
- `/api/products`
- `/api/categories`
- `/api/customers`
- `/api/sales`
- `/api/settings`

These APIs are cached and served offline if network fails.

## Security

**Important:** Cashier mode is **client-side UX only**. Security is still enforced:

1. **API routes must validate** `role === 'cashier'` server-side
2. JWT signature prevents tampering with `allowedRoutes`
3. Cashier can't escalate permissions (static template)
4. Offline mutations queue in IndexedDB, validated when synced online

## Configuration

### Adding Allowed Routes

Edit `lib/cashier-routes.ts`:

```typescript
export const CASHIER_ALLOWED_ROUTES = [
  '/dashboard',
  '/dashboard/sales',
  '/dashboard/customers',
  '/dashboard/returns',  // Add new route
] as const
```

### Adjusting Permissions

Edit `getCashierPermissions()` in `lib/cashier-routes.ts`:

```typescript
export function getCashierPermissions(): Record<string, boolean> {
  return {
    'pos.sales': true,
    'pos.returns': true,  // Add new permission
    'core.customers': true,
  }
}
```

### Service Worker Updates

Cashier routes are automatically detected. To add API patterns, edit `sw.js`:

```javascript
const isCashierAPI = url.pathname.match(/\/api\/(products|returns)/)
```

## Testing

### Test Cashier Login
1. Create a staff member with `role: 'cashier'`
2. Login via staff-login
3. Verify console shows: `(CASHIER MODE - Offline First)`
4. Check sidebar - only cashier routes visible

### Test Offline Mode
1. Open DevTools → Network → Throttling → Offline
2. Navigate between allowed routes
3. Routes should load instantly from cache
4. Try making a sale - should queue for sync

### Test Manager Login
1. Login as manager/supervisor
2. Verify all routes visible based on permissions
3. Permission checks still work normally

## Troubleshooting

**Cashier sees all routes:**
- Check JWT includes `isCashierMode: true`
- Verify `/api/auth/me` returns `isCashierMode` and `allowedRoutes`
- Check console for sidebar state

**Routes not loading offline:**
- Check service worker registered: `navigator.serviceWorker.controller`
- Verify routes cached: DevTools → Application → Cache Storage
- Check console for SW cache hits

**Permission denied errors:**
- Ensure page components don't have hardcoded permission checks
- Cashier routes should skip all permission validation
- Check if middleware is blocking the route

## Migration

Existing staff with `role: 'cashier'` automatically get cashier mode on next login. No database changes needed.

To force immediate update:
1. Clear auth cookies
2. Have cashiers re-login

## Performance

**Before Cashier Mode:**
- Permission check on every navigation → 50-200ms delay
- Cache invalidation on denied access
- Offline unreliable

**After Cashier Mode:**
- Zero permission checks → instant navigation
- Cache stable, no invalidation
- Offline guaranteed for allowed routes
- API responses served from cache when offline

## Future Enhancements

1. **Dynamic Route Updates:** WebSocket push to update `allowedRoutes` without re-login
2. **Role Templates:** Support multiple cashier tiers (cashier-basic, cashier-advanced)
3. **Offline Transaction Limits:** Enforce max transaction value in offline mode
4. **Sync Status UI:** Show cashiers which sales are pending sync
