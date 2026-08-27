# Bar Inventory Data Audit Script

## Purpose

This script performs a comprehensive audit of your bar inventory tracking system to identify data quality issues before implementing fixes to the inventory and reporting systems.

## What It Checks

### 1. Bottle Issues
- Open bottles without `remainingFraction` field
- Open bottles with 0% remaining (should be closed)
- Bottles with invalid `remainingFraction` (<0 or >1)
- Bottles without inventory item references
- Bottles with invalid states

### 2. Tab Line Issues
- Serving sales without bottle tracking (`bottleId`)
- Tab lines with missing inventory items
- Tab lines with missing serving references
- Bottle tracking coverage percentage

### 3. Serving Configuration Issues
- Servings without `servingsPerContainer` configured
- Servings with zero `servingsPerContainer`
- Servings without selling prices
- Orphaned servings (referencing deleted inventory items)

### 4. Inventory Item Issues
- Items without brand references
- Items without buying/selling prices
- Items with negative stock
- Active vs inactive item counts

### 5. Orphaned Records
- Tab lines referencing deleted bottles
- Tab lines referencing deleted inventory items
- Tab lines referencing deleted servings
- Bottles referencing deleted inventory items
- Servings referencing deleted inventory items

## Usage

### Install dependencies first (if tsx is not installed)
```bash
npm install
# or
pnpm install
```

### Audit a specific tenant
```bash
npm run audit:bar <tenantId>
```

Example:
```bash
npm run audit:bar 507f1f77bcf86cd799439011
```

### Audit all tenants
```bash
npm run audit:bar:all
```

## Output

The script provides:

1. **Console output** with real-time progress and findings
2. **Summary report** with:
   - Total counts for each category
   - Warning messages for critical issues
   - Recommendations for fixes
   - Data quality percentages (bottle tracking coverage, serving configuration coverage)
3. **JSON file** (`audit-report-<timestamp>.json`) with complete audit data

## Example Output

```
================================================================================
Auditing Tenant: Demo Bar (507f1f77bcf86cd799439011)
================================================================================

[1/5] Auditing Bottles...
  Total bottles: 45
  Open: 12, Closed: 33
  ⚠️  Open bottles without remainingFraction: 3

[2/5] Auditing Tab Lines...
  Total tab lines: 1523 (1498 active, 25 voided)
  Serving sales: 1420, Bottle sales: 78
  ⚠️  Serving sales without bottle tracking: 234

[3/5] Auditing Servings Configuration...
  Total servings: 8
  ⚠️  Servings without servingsPerContainer: 2

[4/5] Auditing Inventory Items...
  Total inventory items: 67 (65 active, 2 inactive)

[5/5] Checking for Orphaned Records...
  ✅ No orphaned records found

================================================================================
SUMMARY
================================================================================
Bottle Tracking Coverage: 83.5% of serving sales have bottle tracking
Serving Configuration Coverage: 75.0% of servings have servingsPerContainer configured
Total Warnings: 3
Total Recommendations: 3

⚠️  3 warnings:
   1. 3 open bottles missing remainingFraction field
   2. 234 serving sales lack bottleId (16.5% of serving sales)
   3. 2 servings missing servingsPerContainer configuration

💡 3 recommendations:
   1. Run migration to set remainingFraction = 1.0 for newly opened bottles
   2. Ensure POS flow always assigns bottleId when selling servings
   3. Configure servingsPerContainer for all servings (e.g., Tot = 30, Quarter = 15)
```

## Interpreting Results

### Critical Issues (Block Phase 1)
These should be fixed before proceeding with inventory API changes:

- **High percentage of serving sales without bottleId** (>50%)
  - Indicates V2 tracking is not being used properly
  - Need to verify POS flow before fixing reports

- **Most servings without servingsPerContainer** (>50%)
  - Capacity calculations will fail
  - Need to configure servings before enabling projections

### Medium Issues (Fix during Phase 1)
- **Open bottles without remainingFraction** (<20%)
  - Can be fixed with migration script
  - Set to 1.0 for newly opened bottles

- **Some open bottles with 0% remaining**
  - These should be closed
  - Add cleanup step to Phase 1

### Low Issues (Monitor)
- **Small number of orphaned records** (<5%)
  - Clean up during testing phase
  - Add validation to prevent future occurrences

## Next Steps

After running the audit:

1. **Review the JSON report** for detailed breakdown
2. **Calculate readiness score**:
   - Bottle tracking coverage > 80% → Ready for Phase 1
   - Serving config coverage > 80% → Ready for capacity features
   - If either is <80%, address issues first

3. **Create migration scripts** based on findings:
   - Script to set `remainingFraction = 1.0` for open bottles without it
   - Script to close bottles with `remainingFraction = 0`
   - Script to configure missing `servingsPerContainer` values

4. **Re-run audit** after migrations to verify fixes

## Troubleshooting

### Error: "Tenant not found"
- Verify the tenant ID is correct
- Check that the tenant exists in the main database

### Error: "Cannot connect to database"
- Ensure MongoDB is running
- Check `.env` file has correct `MONGODB_URI`

### Script runs but shows 0 for everything
- Check that the tenant has bar module enabled
- Verify bar collections exist in the tenant database
- Ensure collection names match the schema (BarBottle, BarTabLine, etc.)

## Files Generated

- `audit-report-<timestamp>.json` - Full audit data in JSON format
  - Save these reports to track improvements over time
  - Compare reports before/after migrations
