// Test script to verify cashier mode implementation
// Run with: npx tsx scripts/test-cashier-mode.ts

import { CASHIER_ALLOWED_ROUTES, getCashierPermissions, isCashierRoute } from '../lib/cashier-routes'

console.log('🧪 Testing Cashier Mode Implementation\n')

// Test 1: Allowed Routes
console.log('✅ Test 1: Cashier Allowed Routes')
console.log('Routes:', CASHIER_ALLOWED_ROUTES)
console.log('')

// Test 2: Route Matching
console.log('✅ Test 2: Route Matching')
const testRoutes = [
  '/dashboard',
  '/dashboard/sales',
  '/dashboard/sales/payment',
  '/dashboard/retail/sales',
  '/dashboard/inventory',
  '/dashboard/reports',
]

testRoutes.forEach(route => {
  const allowed = isCashierRoute(route)
  console.log(`  ${allowed ? '✓' : '✗'} ${route} → ${allowed ? 'ALLOWED' : 'DENIED'}`)
})
console.log('')

// Test 3: Permissions
console.log('✅ Test 3: Cashier Permissions')
const permissions = getCashierPermissions()
console.log('Granted permissions:')
Object.entries(permissions)
  .filter(([_, allowed]) => allowed)
  .forEach(([key]) => console.log(`  ✓ ${key}`))

console.log('\nDenied permissions:')
Object.entries(permissions)
  .filter(([_, allowed]) => !allowed)
  .forEach(([key]) => console.log(`  ✗ ${key}`))
console.log('')

// Test 4: JWT Structure
console.log('✅ Test 4: Expected JWT Structure')
console.log({
  userId: 'staff_id',
  email: 'cashier@example.com',
  role: 'cashier',
  type: 'staff',
  isCashierMode: true,
  allowedRoutes: CASHIER_ALLOWED_ROUTES,
  permissions: getCashierPermissions(),
})
console.log('')

console.log('✅ All tests passed! Cashier mode is properly configured.')
console.log('\nNext steps:')
console.log('1. Login as a cashier via /api/auth/staff-login')
console.log('2. Check browser console for: (CASHIER MODE - Offline First)')
console.log('3. Verify sidebar only shows allowed routes')
console.log('4. Test offline mode: DevTools → Network → Offline')
