# Login Performance Diagnostics

This document explains how to use the instrumented authentication system to diagnose login performance issues.

## Overview

The authentication system has been instrumented with comprehensive timing measurements and diagnostics to identify performance bottlenecks. No authentication behavior has been changed - only logging and metrics have been added.

## What Was Instrumented

### 1. Database Connection Layer (`lib/db-tenant.ts`)
- **Cache hit/miss tracking**: Records when connections are reused vs newly established
- **Connection timing**: Measures how long each connection takes to establish
- **Pool statistics**: Tracks connection pool usage and eviction behavior

### 2. Login Endpoint (`/api/auth/login`)
- **Tenant loading time**: How long to fetch active tenant list
- **Per-tenant timing**: Connection + query time for each tenant searched
- **Query performance**: Separate timing for User and Staff queries
- **Password hashing time**: Time spent on bcrypt comparison
- **Token creation time**: JWT generation overhead
- **Total end-to-end time**: Complete login duration

### 3. Staff Login Endpoint (`/api/auth/staff-login`)
- Same instrumentation as regular login
- Early exit detection when staff found

### 4. Diagnostics Endpoint (`/api/debug/auth-diagnostics`)
- **Connection pool stats**: Real-time view of cached connections
- **Tenant information**: List of all active tenants
- **Index analysis**: Checks if email indexes exist on User/Staff collections
- **Collection statistics**: Document counts per tenant

## How to Run Diagnostics

### Step 1: Get System Overview

```bash
curl http://localhost:3000/api/debug/auth-diagnostics | jq
```

This returns:
- Number of active tenants
- Connection pool status
- Index existence for each tenant
- Collection sizes

**Look for:**
- ❌ Missing email indexes (major performance issue)
- ⚠️ Large tenant counts (>10 tenants means pool evictions)
- ⚠️ Low cache hit rates (connections not being reused)

### Step 2: Run Login Tests

Update `scripts/test-login-performance.ts` with your actual test credentials, then:

```bash
npx tsx scripts/test-login-performance.ts
```

This will:
1. Test various login scenarios
2. Measure response times
3. Test cache warmup (repeat login)
4. Show detailed server logs

**Look for:**
- Total login time >2000ms indicates a problem
- Large differences between first and second login (cache working)
- Server logs showing per-tenant breakdown

### Step 3: Monitor Real Logins

Watch server logs during actual user logins:

```bash
# In your terminal running the dev server
# Look for these log patterns:
```

```
========================================
[login] 🔐 LOGIN ATTEMPT: user@example.com
========================================

[db-tenant] ✓ Cache HIT for mongodb://... (2ms)
[db-tenant] ✗ Cache MISS, establishing new connection to mongodb://... 
[db-tenant] ✓ Connection established in 245ms (total: 247ms)

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
[login]   ⏱️  TOTAL:              1024ms
========================================
```

## Interpreting Results

### Connection Times

| Time | Status | Action |
|------|--------|--------|
| <10ms | ✅ Excellent (cache hit) | None |
| 10-100ms | ✅ Good (local network) | None |
| 100-300ms | ⚠️ Moderate (remote DB) | Consider connection pooling |
| >300ms | ❌ Poor | Check network, DB location |

### Query Times

| Time | Status | Action |
|------|--------|--------|
| <5ms | ✅ Excellent (indexed) | None |
| 5-20ms | ✅ Good (indexed, small collection) | None |
| 20-50ms | ⚠️ Moderate (might be missing index) | Check indexes |
| >50ms | ❌ Poor | Missing index or large collection |

### Total Login Time

| Time | User Experience | Action |
|------|----------------|--------|
| <500ms | ✅ Excellent | None needed |
| 500-1000ms | ✅ Acceptable | Monitor |
| 1-2s | ⚠️ Noticeable delay | Optimize |
| >2s | ❌ Poor UX | Immediate optimization needed |

### Cache Hit Rate

```
Cache hit rate = hits / (hits + misses)
```

| Rate | Status | Meaning |
|------|--------|---------|
| >80% | ✅ Excellent | Connections reused effectively |
| 50-80% | ✅ Good | Normal for varied tenant access |
| <50% | ⚠️ Poor | Pool too small or too many tenants |

## Common Issues & Solutions

### Issue 1: Missing Email Indexes

**Symptoms:**
- Query times >50ms per tenant
- Diagnostics show `hasEmailIndex: false`

**Impact:** 50-200ms added per tenant search

**Solution:**
```typescript
// Run migration to add indexes
db.users.createIndex({ email: 1 })
db.staff.createIndex({ email: 1 })
```

### Issue 2: Connection Pool Thrashing

**Symptoms:**
- Many "Cache MISS" logs
- "Pool full, evicting" messages
- More tenants than `MAX_CACHED_TENANTS` (10)

**Impact:** 100-300ms overhead per eviction

**Solution:**
- Increase `MAX_CACHED_TENANTS` to match tenant count
- Implement proper LRU eviction
- Pre-warm connections at startup

### Issue 3: Sequential Search Overhead

**Symptoms:**
- Total tenant search time = (tenant count × avg time)
- Login time increases linearly with tenant count

**Impact:** 600ms per tenant (unoptimized)

**Solution (in order):**
1. Fix indexes (biggest win)
2. Optimize connection pooling
3. Implement bounded parallelism
4. Add smart search ordering
5. Consider centralized identity index (if >50 tenants)

### Issue 4: Password Hashing Bottleneck

**Symptoms:**
- Password check time >200ms
- Multiple candidates being checked

**Impact:** 200-500ms per candidate

**Solution:**
- bcrypt work factor too high (check salt rounds)
- Early exit after first match
- Consider Argon2 for better performance

## Next Steps After Diagnosis

Based on measurements, implement optimizations in this order:

1. **Add missing indexes** (if any) → Biggest immediate win
2. **Cache tenant list** → Eliminate repeated admin DB queries
3. **Fix connection pool** → If seeing evictions
4. **Bounded parallelism** → If >10 tenants and sequential is slow
5. **Smart search ordering** → If access patterns are skewed
6. **Centralized identity** → Only if >50 tenants and still slow

## Clean Up

To remove instrumentation after optimization:
1. Remove console.log statements (keep error logs)
2. Keep timing metrics in production (low overhead)
3. Keep diagnostics endpoint behind admin auth
4. Consider adding metrics to monitoring service

## Questions to Answer

After running diagnostics, you should know:

- ✅ How many active tenants exist?
- ✅ Do all tenants have email indexes?
- ✅ What's the average connection time?
- ✅ What's the average query time?
- ✅ Are connections being cached/reused?
- ✅ Where is most time spent? (connection, query, password, token)
- ✅ Does login time scale linearly with tenant count?
- ✅ What's the actual user-perceived login time?

These answers will guide which optimization to implement first.
