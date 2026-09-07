# Module-Level Gating Fix for Report Types

## Problem
Report types were showing based only on individual feature flags without checking module-level access. This caused:
- Wonders Shop (retail-only tenant) seeing Kitchen and Bar reports
- Tenants could access reports for modules they don't have
- Inconsistency with sidebar behavior (sidebar respects module access)

## Root Cause
The system stores features granularly (`kds.chef`, `bar.tabs`) without explicit module ownership. Reports API checked individual features but didn't verify if tenant actually has the parent module enabled.

**Example:**
```
Tenant has: { 'kds.chef': true, 'bar.tabs': true }
But doesn't actually use Service module
→ Kitchen & Bar reports still appeared
```

## Solution Implemented

### Architecture: Two-Tier Permission Check
```
Module Level (Service, Retail, Rentals, Pharmacy)
    ↓
Feature Level (kds.chef, bar.tabs, pos.inventory)
```

### Changes Made

**1. Updated `lib/report-types.ts`:**
- Added `requiredModule` field to `ReportTypeDefinition`
- Each report now specifies both module AND feature requirements
- Kitchen report: requires `service` module + `kds.chef` feature
- Bar report: requires `service` module + `bar.tabs` feature
- Inventory report: requires `retail` module + `pos.inventory` feature

**2. Enhanced filtering logic:**
- Uses existing `featuresToModuleKeys()` from `lib/modules.ts`
- This function infers enabled modules by checking if tenant has ANY feature from that module
- Reports filter: Module check FIRST, then feature check
- Matches sidebar's module-aware behavior

### Report Type Configuration

```typescript
{
  value: 'kitchen',
  label: 'Kitchen Report',
  requiredModule: 'service',    // ← NEW: Must have Service module
  requiredFeature: 'kds.chef',  // ← AND must have this feature
}
```

### Logic Flow
```
1. Get tenant's enabled features from database
2. Infer enabled modules using featuresToModuleKeys()
   → Returns ['retail', 'service'] if ANY Service feature is true
3. For each report type:
   a. Check: Does tenant have required module? (if specified)
   b. Check: Does tenant have required feature? (if specified)
   c. Include only if BOTH pass
```

## How It Works

**Scenario 1: Retail-only tenant (Wonders Shop)**
```
Features: { 'pos.inventory': true, 'pos.sales': true }
Modules: ['retail']
Result: Only Sales, Inventory, Profit reports show
✅ Kitchen & Bar reports hidden (no 'service' module)
```

**Scenario 2: Full-service tenant**
```
Features: { 'pos.inventory': true, 'kds.chef': true, 'bar.tabs': true }
Modules: ['retail', 'service']
Result: All reports show
✅ Kitchen & Bar reports appear (has 'service' module)
```

**Scenario 3: Service tenant with only Kitchen**
```
Features: { 'kds.chef': true, 'bar.tabs': false }
Modules: ['service']
Result: Sales, Profit, Kitchen reports show
✅ Bar report hidden (feature disabled)
✅ Kitchen report shows (module + feature both enabled)
```

## Benefits

✅ **Hierarchical Permissions**: Module → Feature, as intended
✅ **Consistent with Sidebar**: Reports match navigation access
✅ **Secure**: Can't bypass module restrictions via feature flags
✅ **Maintainable**: Leverages existing `featuresToModuleKeys()` helper
✅ **Backward Compatible**: No database changes needed

## Testing

**Verify with Wonders Shop:**
1. Go to Reports page
2. Check dropdown - should NOT see Kitchen/Bar reports
3. Should only see: Sales, Inventory (if enabled), Profit

**Verify with full tenant:**
1. Tenant with Service module enabled
2. Should see Kitchen and/or Bar reports based on features

## Files Modified
- `lib/report-types.ts` - Added module checking logic
