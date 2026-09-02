# Quick Start: Login Performance Diagnostics

## 🚀 Run Diagnostics (3 Steps)

### Step 1: Check System State
```bash
npm run diagnose:auth | jq > baseline-diagnostics.json
```

**This shows:**
- Number of active tenants
- Connection pool status  
- Email indexes status
- Collection sizes

---

### Step 2: Update Test Credentials

Open `scripts/test-login-performance.ts` and update lines 46-65 with real credentials:

```typescript
const testCases = [
  {
    type: 'user',
    email: 'YOUR_REAL_USER@example.com',    // ← CHANGE THIS
    password: 'YOUR_PASSWORD',               // ← CHANGE THIS
    description: 'Real owner login'
  },
  {
    type: 'staff',
    email: 'YOUR_STAFF@example.com',         // ← CHANGE THIS
    password: 'STAFF_PASSWORD',              // ← CHANGE THIS
    description: 'Real staff login'
  },
]
```

---

### Step 3: Run Performance Tests

Terminal 1:
```bash
npm run dev
```

Terminal 2:
```bash
npm run test:login
```

Watch **both terminals** for detailed output.

---

## 📊 What to Look For

### In Diagnostics Output (`baseline-diagnostics.json`)

```json
{
  "tenantInfo": {
    "totalActive": 5  // ← How many tenants?
  },
  "indexAnalysis": [
    {
      "users": {
        "hasEmailIndex": true  // ← Should be true!
      },
      "staff": {
        "hasEmailIndex": true  // ← Should be true!
      }
    }
  ]
}
```

**Action Items:**
- If `totalActive > 10` → Connection pool may be too small
- If `hasEmailIndex: false` → **Add indexes immediately** (major issue)

---

### In Test Output (Terminal 2)

```
Total tests: 4
Successful: 3
Failed: 1

Successful Login Performance:
  Average: 892ms     ← Target: <500ms ideal, <2000ms acceptable
  Min: 234ms
  Max: 1456ms
```

**Action Items:**
- If average >2000ms → **Optimization needed**
- If average >500ms → **Consider optimization**
- If average <500ms → **No action needed**

---

### In Server Logs (Terminal 1)

```
[login] 📊 PERFORMANCE SUMMARY:
[login]   Tenant load:           12ms
[login]   Tenant search:         892ms    ← Most time here?
[login]     - Avg connection:    125ms    ← Slow connections?
[login]     - Avg user query:    15ms     ← >50ms = missing index
[login]   Password check:        180ms    ← Normal
[login]   Token creation:        5ms      ← Normal
[login]   ⏱️  TOTAL:              1089ms
```

**Identify Bottleneck:**
- `Tenant search` taking most time? → Connection or query issue
- `Avg connection > 200ms`? → Remote DB or connection pooling
- `Avg query > 50ms`? → **Missing indexes**
- `Password check > 300ms`? → Too many candidates or high bcrypt rounds

---

## 🎯 Decision Matrix

| Finding | Action |
|---------|--------|
| Missing email indexes | **Add indexes immediately** |
| <5 tenants, <500ms total | No action needed |
| 5-10 tenants, 500-1000ms | Cache tenant list |
| 10-20 tenants, 1-2s | Connection pool optimization |
| >20 tenants, >2s | Bounded parallelism |
| >50 tenants, >5s | Consider centralized identity |

---

## 🔧 Quick Commands Reference

```bash
# System diagnostics
npm run diagnose:auth | jq

# Performance tests
npm run test:login

# View detailed logs
npm run dev  # and watch output

# Save results
npm run diagnose:auth | jq > baseline-$(date +%Y%m%d).json
npm run test:login > test-results-$(date +%Y%m%d).txt
```

---

## 📋 Checklist

Before optimization discussion, collect:

- [ ] Number of active tenants: ___
- [ ] All tenants have email indexes: Yes / No
- [ ] Average total login time: ___ ms
- [ ] Cache hit rate: ___%
- [ ] Primary bottleneck: ___________
- [ ] Saved diagnostics output: baseline-diagnostics.json
- [ ] Saved test results: test-results.txt
- [ ] Saved server logs snippet

---

## 📚 Full Documentation

- Complete guide: `docs/LOGIN-PERFORMANCE-DIAGNOSTICS.md`
- Baseline plan: `PERFORMANCE-BASELINE-PLAN.md`
- Full summary: `LOGIN-PERFORMANCE-INSTRUMENTATION-SUMMARY.md`

---

## ⚡ TL;DR

```bash
# Run this in 2 terminals:
npm run dev                    # Terminal 1
npm run test:login            # Terminal 2

# Then review both outputs and document:
# 1. Number of tenants
# 2. Index status
# 3. Average login time
# 4. Primary bottleneck
```

**Then we discuss which optimization to implement based on data.**
