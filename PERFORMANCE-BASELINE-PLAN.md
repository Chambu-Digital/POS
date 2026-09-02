# Login Performance Baseline Plan

## What Was Done

Comprehensive instrumentation has been added to the authentication system **without changing any behavior**. Only logging, timing, and diagnostic capabilities were added.

## Files Modified

### 1. `lib/db-tenant.ts`
- Added cache hit/miss tracking with statistics
- Added detailed connection timing logs
- Added `getTenantConnectionStats()` function to export metrics
- Connection behavior unchanged

### 2. `app/api/auth/login/route.ts`
- Added detailed timing for every phase:
  - Tenant list loading
  - Per-tenant connection establishment
  - Per-tenant User/Staff queries
  - Password comparison
  - Token creation
- Added structured console logging with visual indicators
- Added performance summary at end of each login attempt
- Authentication logic unchanged

### 3. `app/api/auth/staff-login/route.ts`
- Same instrumentation as regular login
- Tracks early exit optimization (stops when staff found)
- Authentication logic unchanged

## Files Created

### 1. `app/api/debug/auth-diagnostics/route.ts`
New diagnostic endpoint that provides:
- Connection pool statistics
- Active tenant count and details
- Index analysis for User/Staff collections in all tenants
- Collection statistics (document counts)

**Usage:** `GET /api/debug/auth-diagnostics`

### 2. `scripts/test-login-performance.ts`
Test harness to run representative login scenarios:
- Demo user login
- Regular user login
- Staff login
- Invalid login (full tenant scan)
- Cache warmup test (repeat login)

**Usage:** `npx tsx scripts/test-login-performance.ts`

### 3. `docs/LOGIN-PERFORMANCE-DIAGNOSTICS.md`
Complete guide explaining:
- How to use the instrumentation
- How to interpret results
- Common issues and solutions
- Performance benchmarks and thresholds

## How to Collect Baseline

### Step 1: Run Diagnostics Endpoint

```bash
curl http://localhost:3000/api/debug/auth-diagnostics | jq > baseline-diagnostics.json
```

This will show:
- Number of active tenants
- Whether email indexes exist
- Connection pool status
- Collection sizes

### Step 2: Update Test Script

Edit `scripts/test-login-performance.ts` and replace test credentials:

```typescript
const testCases = [
  {
    type: 'user',
    email: 'YOUR_REAL_USER@example.com',
    password: 'YOUR_PASSWORD',
    description: 'Real owner login'
  },
  {
    type: 'staff',
    email: 'YOUR_REAL_STAFF@example.com',
    password: 'STAFF_PASSWORD',
    description: 'Real staff login'
  },
]
```

### Step 3: Run Performance Tests

```bash
# Start your dev server if not running
npm run dev

# In another terminal:
npx tsx scripts/test-login-performance.ts
```

Save the output to a file for analysis.

### Step 4: Analyze Server Logs

The dev server console will show detailed breakdowns like:

```
========================================
[login] 🔐 LOGIN ATTEMPT: user@example.com
========================================

[db-tenant] ✗ Cache MISS, establishing new connection...
[db-tenant] ✓ Connection established in 245ms

[login] 📊 Loaded 5 active tenants in 12ms

[login] 🔍 Searching across all tenants...
[login]   Tenant 1/5 (Shop A): ✓ OWNER found (conn: 3ms, query: 8ms)
[login]   Tenant 2/5 (Shop B): - no owner (conn: 245ms, query: 12ms)
...

========================================
[login] ✅ LOGIN SUCCESS
[login] 📊 PERFORMANCE SUMMARY:
[login]   Tenant load:           12ms
[login]   Tenant search:         892ms
[login]     - Avg connection:    125ms
[login]     - Avg user query:    15ms
[login]     - Avg staff query:   18ms
[login]   Password check:        180ms
[login]   Token creation:        5ms
[login]   ⏱️  TOTAL:              1089ms
========================================
```

## Key Metrics to Collect

From the diagnostics and test runs, document:

1. **Tenant Count**: How many active tenants?
2. **Index Status**: Do all tenants have email indexes?
3. **Connection Times**:
   - Cache hit: X ms
   - Cache miss: Y ms
   - Average: Z ms
4. **Query Times**:
   - User queries: X ms avg
   - Staff queries: Y ms avg
5. **Total Login Time**:
   - First login: X ms
   - Cached login: Y ms
   - Average: Z ms
6. **Cache Performance**:
   - Hit rate: X%
   - Evictions: yes/no
7. **Bottleneck Identification**:
   - Where is most time spent?

## Decision Matrix

Based on measurements, you'll know which optimization to tackle:

| Tenant Count | Avg Login Time | Missing Indexes | Next Action |
|--------------|----------------|-----------------|-------------|
| Any | Any | Yes | **Add indexes first** |
| <5 | <500ms | No | **No action needed** |
| 5-10 | 500-1000ms | No | **Cache tenant list** |
| 10-20 | 1-2s | No | **Connection pool + caching** |
| 20-50 | 2-5s | No | **Bounded parallelism** |
| >50 | >5s | No | **Consider centralized identity** |

## What NOT to Do Yet

- ❌ Don't implement any optimizations
- ❌ Don't change authentication logic
- ❌ Don't add new features
- ❌ Don't guess at solutions

## What TO Do

- ✅ Run diagnostics endpoint
- ✅ Update test script with real credentials
- ✅ Run performance tests
- ✅ Collect and save baseline measurements
- ✅ Analyze server logs
- ✅ Document findings
- ✅ Identify the actual bottleneck
- ✅ Discuss results and decide on optimization approach

## Safety Notes

- All instrumentation is safe for production (low overhead)
- Console logs can be disabled later (just remove console.log statements)
- Diagnostic endpoint should be protected with admin auth in production
- Test script is for development only (contains passwords)
- No authentication behavior was changed

## Next Steps

After collecting baseline:

1. **Review measurements** together
2. **Identify primary bottleneck** (connection, query, password, token)
3. **Check for missing indexes** (quick win if found)
4. **Decide on optimization strategy** based on data, not assumptions
5. **Implement targeted fix** for the actual bottleneck
6. **Measure again** to verify improvement
7. **Iterate** if needed

The goal is **data-driven optimization**, not premature optimization.
