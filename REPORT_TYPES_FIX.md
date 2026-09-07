# Report Types Dynamic Fix

## Problem
The retail reports page had a hardcoded static list of report types in the dropdown, which didn't respect tenant-specific enabled features/modules.

## Solution Implemented

### 1. Created Report Type Configuration (`lib/report-types.ts`)
- Defines all available report types with their labels and descriptions
- Maps each report type to its required feature (e.g., 'bar' report requires 'bar.tabs' feature)
- Includes `getAvailableReportTypes()` utility function to filter based on enabled features
- Reports without a required feature (sales, profit) are always available

### 2. Created API Endpoint (`app/api/reports/types/route.ts`)
- GET endpoint at `/api/reports/types`
- Fetches current tenant's enabled features
- Normalizes features using existing `normaliseFeatures()` from `lib/modules.ts`
- Returns only report types available to that tenant

### 3. Updated Reports Page (`app/dashboard/reports/page.tsx`)
- Added `availableReportTypes` state to store dynamic list
- Added `fetchReportTypes()` function called on mount
- Dropdown now renders dynamically from `availableReportTypes` array
- Default report type automatically set to first available option
- Generate button disabled if no report types available

## Benefits
- ✅ Tenants only see report types relevant to their enabled modules
- ✅ Easy to add new report types (just update `lib/report-types.ts`)
- ✅ Respects multi-tenant feature flags
- ✅ Clean separation of concerns
- ✅ No breaking changes to existing functionality

## Files Modified
1. `lib/report-types.ts` (new)
2. `app/api/reports/types/route.ts` (new)
3. `app/dashboard/reports/page.tsx` (updated)

## Testing Checklist
- [ ] Verify reports page loads without errors
- [ ] Check that dropdown shows only enabled module reports
- [ ] Test with different tenant feature configurations
- [ ] Ensure report generation still works correctly
- [ ] Verify default report type is set appropriately
