# Phase 0: Bar Data Audit - Quick Start Guide

## Overview

Before implementing the bar inventory and reporting fixes, we need to understand the current state of the data. This phase audits your existing bar data to identify issues that could affect the implementation.

## Quick Start (5 minutes)

### 1. Install dependencies
```bash
npm install
```

### 2. Run the audit
```bash
# For a specific tenant (recommended for first run)
npm run audit:bar <YOUR_TENANT_ID>

# Or audit all tenants
npm run audit:bar:all
```

### 3. Review the output
The audit will print results to the console and save a JSON report file.

### 4. Decide next steps based on results

**Decision Matrix:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| Bottle Tracking Coverage | ≥ 80% | ✅ Proceed to Phase 1 |
| Bottle Tracking Coverage | 50-79% | ⚠️ Fix data first, then proceed |
| Bottle Tracking Coverage | < 50% | 🛑 Review POS flow before proceeding |
| Serving Config Coverage | ≥ 80% | ✅ Can enable capacity features |
| Serving Config Coverage | < 80% | ⚠️ Configure servings manually |

## What Gets Audited

### Critical Issues (Block Implementation)
- ❌ **Serving sales without bottle tracking**
  - Impact: Cannot generate accurate serving sales reports
  - Fix: Review POS flow to ensure bottleId is assigned

- ❌ **Servings without servingsPerContainer**
  - Impact: Cannot calculate bottle capacity projections
  - Fix: Configure each serving with correct capacity

### Medium Issues (Can Fix with Script)
- ⚠️ **Open bottles without remainingFraction**
  - Impact: Inventory counts may be inaccurate
  - Fix: Run fix script to set remainingFraction = 1.0

- ⚠️ **Open bottles with 0% remaining**
  - Impact: Bottles should be closed
  - Fix: Run fix script to close these bottles

### Low Issues (Fix During Testing)
- ℹ️ **Negative stock items**
  - Impact: Indicates data corruption
  - Fix: Manual investigation needed

- ℹ️ **Orphaned records**
  - Impact: Broken references in reports
  - Fix: Clean up during testing phase

## Running the Fix Script

After running the audit and reviewing results:

### 1. Dry run (see what would be fixed)
```bash
npm run fix:bar <TENANT_ID> -- --dry-run
```

### 2. Apply fixes
```bash
npm run fix:bar <TENANT_ID>
```

### 3. Re-audit to verify
```bash
npm run audit:bar <TENANT_ID>
```

## What the Fix Script Does

**Automatic Fixes:**
- ✅ Sets `remainingFraction = 1.0` for open bottles without it
- ✅ Closes bottles with `remainingFraction = 0`

**Manual Fixes Required:**
- ⚠️ Serving configuration (servingsPerContainer)
- ⚠️ Negative stock investigation
- ⚠️ Orphaned record cleanup

## Example Workflow

```bash
# 1. Run audit for tenant ID: 507f1f77bcf86cd799439011
npm run audit:bar 507f1f77bcf86cd799439011

# Output shows:
# - Bottle Tracking Coverage: 85.2% ✅
# - Serving Config Coverage: 62.5% ⚠️
# - 3 open bottles without remainingFraction
# - 5 servings need servingsPerContainer

# 2. Fix automatic issues (dry run first)
npm run fix:bar 507f1f77bcf86cd799439011 -- --dry-run

# 3. Apply fixes
npm run fix:bar 507f1f77bcf86cd799439011

# 4. Manually configure servings
# Go to: Bar → Products → [Product] → Servings
# Set servingsPerContainer:
# - Tot = 30
# - Quarter = 15
# - Glass = 6
# etc.

# 5. Re-audit to verify
npm run audit:bar 507f1f77bcf86cd799439011

# Output now shows:
# - Bottle Tracking Coverage: 85.2% ✅
# - Serving Config Coverage: 100% ✅
# - 0 open bottles without remainingFraction ✅
```

## Interpreting Results

### Green Light (Proceed to Phase 1)
```
Bottle Tracking Coverage: 85.2% of serving sales have bottle tracking ✅
Serving Configuration Coverage: 100.0% of servings configured ✅
Total Warnings: 0
```
**Action:** Proceed with Phase 1 implementation

### Yellow Light (Fix First)
```
Bottle Tracking Coverage: 65.8% of serving sales have bottle tracking ⚠️
Serving Configuration Coverage: 75.0% of servings configured ⚠️
Total Warnings: 3
```
**Action:** 
1. Run fix script for automatic issues
2. Manually configure remaining servings
3. Re-audit before proceeding

### Red Light (Investigation Needed)
```
Bottle Tracking Coverage: 12.3% of serving sales have bottle tracking 🛑
Serving Configuration Coverage: 25.0% of servings configured 🛑
Total Warnings: 15
```
**Action:**
1. **Stop** - Do not proceed with Phase 1
2. Review POS flow - Why is bottle tracking not working?
3. Check if V2 tracking was enabled recently (old data lacks tracking)
4. Consider setting a cutoff date for reports (e.g., only show data after V2 was enabled)

## Understanding the JSON Report

The JSON report contains detailed breakdowns:

```json
{
  "tenantId": "507f1f77bcf86cd799439011",
  "tenantName": "Demo Bar",
  "timestamp": "2026-08-27T10:30:00.000Z",
  "bottleIssues": {
    "totalBottles": 45,
    "openBottles": 12,
    "closedBottles": 33,
    "openWithoutRemaining": 3,
    // ... more metrics
  },
  "tabLineIssues": {
    "totalTabLines": 1523,
    "servingSales": 1420,
    "servingSalesWithoutBottleId": 234,
    // ... more metrics
  },
  "warnings": [
    "234 serving sales lack bottleId (16.5% of serving sales)"
  ],
  "recommendations": [
    "Ensure POS flow always assigns bottleId when selling servings"
  ]
}
```

## FAQ

**Q: Can I skip Phase 0?**
A: Not recommended. Without knowing your data quality, Phase 1 implementation might expose serious issues.

**Q: What if I have multiple tenants?**
A: Run `npm run audit:bar:all` to audit all tenants at once. Review each report individually.

**Q: The audit found no issues. Is something wrong?**
A: Possible causes:
- Bar module not enabled for this tenant
- No bar data exists yet (new tenant)
- Collections are empty

**Q: Can I audit production data?**
A: Yes, the audit is read-only and makes no changes. The fix script requires explicit execution.

**Q: How long does the audit take?**
A: 
- Small tenant (< 1000 transactions): 5-10 seconds
- Medium tenant (1000-10000 transactions): 30-60 seconds
- Large tenant (> 10000 transactions): 1-2 minutes

**Q: What if bottle tracking coverage is low due to old data?**
A: Consider these options:
1. Set a report cutoff date (e.g., only show data after V2 tracking was enabled)
2. Run a backfill migration to add bottleId to old records (risky)
3. Accept that old data lacks tracking and focus on new data going forward

## Next Steps

After completing Phase 0:

1. ✅ Save the audit report for reference
2. ✅ Fix automatic issues with the fix script
3. ✅ Manually configure servings if needed
4. ✅ Re-audit to verify fixes
5. ✅ Review readiness thresholds
6. ➡️ **Proceed to Phase 1** if metrics are green

If metrics are not green:
- Review POS flow implementation
- Check serving configuration
- Investigate data quality issues
- Consider data cutoff dates for reports

## Files Created

- `scripts/audit-bar-data.ts` - Main audit script
- `scripts/fix-bar-data-issues.ts` - Automatic fix script  
- `scripts/README-audit.md` - Detailed documentation
- `audit-report-<timestamp>.json` - Generated report (after running)

## Support

If you encounter issues:
1. Check the console output for specific error messages
2. Verify MongoDB connection in `.env`
3. Ensure tenant ID is correct
4. Check that bar collections exist in tenant database
