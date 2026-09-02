# Login Performance Instrumentation - Summary

## ✅ Completed

The authentication system has been fully instrumented with comprehensive diagnostics **without changing any authentication behavior**.

## 📁 Files Changed

### Modified (instrumentation added)
1. **`lib/db-tenant.ts`** - Connection caching metrics
2. **`app/api/auth/login/route.ts`** - Detailed login timing
3. **`app/api/auth/staff-login/route.ts`** - Staff login timing

### Created (new diagnostic tools)
4. **`app/api/debug/auth-diagnostics/route.ts`** - System diagnostics endpoint
5. **`scripts/test-login-performance.ts`** - Performance test harness
6. **`docs/LOGIN-PERFORMANCE-DIAGNOSTICS.md`** - Complete usage guide
7. **`PERFORMANCE-BASELINE-PLAN.md`** - Step-by-step baseline collection plan

## 🎯 What You Can Now Measure

### System-Level Metrics
- ✅ Number of active tenants
- ✅ Connection pool status (cached connections, hit/miss rate)
- ✅ Email index existence for all tenants
- ✅ Collection sizes (user/staff counts)

### Per-Login Metrics
- ✅ Total login duration (end-to-end)
- ✅ Tenant list loading time
- ✅ Per-tenant connection time (cache hit vs miss)
- ✅ Per-tenant query time (user + staff)
- ✅ Password hashing/comparison time
- ✅ Token creation time
- ✅ Number of tenants searched before match

### Performance Patterns
- ✅ Cache warming behavior (first vs repeat login)
- ✅ Connection pool eviction patterns
- ✅ Query performance variations across tenants
- ✅ Bottleneck identification (connection, query, password, token)

## 🚀 Next Steps (In Order)

### 1. Run System Diagnostics

```bash
# Get baseline system state
curl http://localhost:3000/api/debug/auth-diagnostics | jq > baseline-diagnostics.json
```

**Look for:**
- How many active tenants?
- Are email indexes missing?
- Is the connection pool too small?

### 2. Update Test Credentials

Edit `scripts/test-login-performance.ts` lines 46-65 with real test accounts:

```typescript
const testCases = [
  {
    type: 'user',
    email: 'your-real-user@example.com',  // UPDATE THIS
    password: 'your-password',             // UPDATE THIS
    description: 'Real owner login'
  },
  // ... add more test cases
]
```

### 3. Run Performance Tests

```bash
# Make sure dev server is running
npm run dev

# In another terminal
npx tsx scripts/test-login-performance.ts > baseline-test-results.txt
```

### 4. Analyze Results

Watch both:
- **Terminal output** from test script (shows summary stats)
- **Dev server logs** (shows detailed breakdowns)

Save both outputs for analysis.

### 5. Collect Key Numbers

Document these metrics:

```
=== BASELINE MEASUREMENTS ===

System:
- Active tenants: ___
- Missing indexes: ___
- Connection pool size: ___ / ___
- Cache hit rate: ___%

Performance:
- Average total login time: ___ ms
- First login time: ___ ms
- Cached login time: ___ ms

Breakdown (average):
- Tenant load: ___ ms
- Tenant search: ___ ms
- Avg connection time: ___ ms
- Avg user query: ___ ms
- Avg staff query: ___ ms
- Password check: ___ ms
- Token creation: ___ ms

Primary Bottleneck: ___________
```

## 🔍 What to Look For

### Red Flags (Immediate Action)
- ❌ **Missing indexes**: Query times >50ms → Add indexes immediately
- ❌ **Pool thrashing**: "Pool full, evicting" messages → Increase pool size
- ❌ **Total time >2000ms**: Poor user experience → Optimization needed

### Yellow Flags (Monitor)
- ⚠️ **Connection times >200ms**: Remote database or slow network
- ⚠️ **Query times 20-50ms**: Possible index issues or large collections
- ⚠️ **Cache hit rate <50%**: Pool too small or too many tenants

### Green Flags (Good)
- ✅ **Total time <500ms**: Excellent performance
- ✅ **Cache hit rate >80%**: Effective connection reuse
- ✅ **Query times <20ms**: Good indexes

## 📊 Example Output

### Diagnostics Endpoint
```json
{
  "timestamp": "2026-09-02T10:30:00.000Z",
  "connectionStats": {
    "maxCachedTenants": 10,
    "currentCached": 5,
    "connections": [
      {
        "uri": "mongodb://...",
        "hits": 15,
        "misses": 1,
        "hitRate": "93.8%"
      }
    ]
  },
  "tenantInfo": {
    "totalActive": 5
  },
  "indexAnalysis": [
    {
      "tenant": "Shop A",
      "users": {
        "count": 1,
        "hasEmailIndex": true
      },
      "staff": {
        "count": 3,
        "hasEmailIndex": true
      }
    }
  ]
}
```

### Server Log Output
```
========================================
[login] 🔐 LOGIN ATTEMPT: user@example.com
========================================

[db-tenant] ✓ Cache HIT for mongodb://... (2ms)
[login] 📊 Loaded 5 active tenants in 12ms
[login] 🔍 Searching across all tenants...

[login]   Tenant 1/5 (Shop A): ✓ OWNER found (conn: 3ms, query: 8ms)

========================================
[login] ✅ LOGIN SUCCESS
[login] 📊 PERFORMANCE SUMMARY:
[login]   Tenant load:           12ms
[login]   Tenant search:         45ms
[login]     - Avg connection:    3ms
[login]     - Avg user query:    8ms
[login]   Password check:        180ms
[login]   Token creation:        5ms
[login]   ⏱️  TOTAL:              242ms
========================================
```

## 🛠️ Optimization Decision Tree

```
After collecting baseline:

1. Are indexes missing?
   YES → Add indexes first (biggest win)
   NO  → Continue to #2

2. Is total login time <500ms?
   YES → No optimization needed
   NO  → Continue to #3

3. How many active tenants?
   <5   → Connection pooling optimization
   5-10  → Cache tenant list
   10-20 → Bounded parallelism
   >20  → Consider centralized identity

4. Where is most time spent?
   Connection → Optimize connection pooling
   Query      → Check indexes, consider parallelism
   Password   → Check bcrypt rounds, early exit
   Token      → Unlikely bottleneck
```

## ⚙️ Safety & Production

### Safe for Production
- ✅ All instrumentation has minimal overhead
- ✅ Connection caching behavior unchanged
- ✅ Authentication logic unchanged
- ✅ Timing measurements use high-resolution timers

### Production Considerations
- 🔒 Protect `/api/debug/auth-diagnostics` with admin auth
- 📝 Reduce console.log verbosity (keep error logs)
- 📊 Consider sending metrics to monitoring service
- 🗑️ Remove test script from production build

## 📚 Documentation

- **Complete usage guide**: `docs/LOGIN-PERFORMANCE-DIAGNOSTICS.md`
- **Baseline collection plan**: `PERFORMANCE-BASELINE-PLAN.md`
- **This summary**: `LOGIN-PERFORMANCE-INSTRUMENTATION-SUMMARY.md`

## 🎬 Quick Start

```bash
# 1. Run diagnostics
curl http://localhost:3000/api/debug/auth-diagnostics | jq

# 2. Update test credentials in scripts/test-login-performance.ts

# 3. Run tests
npm run dev  # in one terminal
npx tsx scripts/test-login-performance.ts  # in another

# 4. Analyze and document results

# 5. Discuss findings and decide on optimization
```

## 💡 Remember

- **Measure first, optimize second**
- **No assumptions, only data**
- **Target the actual bottleneck**
- **One optimization at a time**
- **Verify improvement with measurements**

---

**Status**: ✅ Ready for baseline collection  
**Next Action**: Run diagnostics and tests, then discuss results
