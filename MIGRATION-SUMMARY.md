# Data Ownership Migration Summary

## Problem
Products and sales were being tied to individual staff member accounts instead of the shop owner's account. This caused:
- Admin/owner accounts showing 0 inventory and 0 sales
- Staff accounts showing all the data
- Data fragmentation across multiple user accounts

## Root Cause
When staff members logged in and created products or made sales, the system was using their personal `userId` instead of their admin's `userId`. This happened because:
1. The JWT token only contained the staff member's own userId
2. API routes were using `payload.userId` directly without checking if the user was staff
3. No logic existed to link staff actions back to the shop owner

## Solution Implemented

### 1. Updated JWT Token Structure
- Added `adminId` field to TokenPayload interface
- When staff members log in, their token now includes both:
  - `userId`: Their own staff ID
  - `adminId`: Their shop owner's ID

### 2. Updated API Routes
All product and sales API routes now use this logic:
```javascript
const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
```

**Updated Routes:**
- ✅ `/api/products` (GET, POST)
- ✅ `/api/products/[id]` (PUT, DELETE)
- ✅ `/api/products/import` (POST)
- ✅ `/api/sales` (GET, POST)

**Not Changed (Correct as-is):**
- `/api/staff/*` - These correctly use payload.userId to manage staff belonging to the admin

### 3. Migration Script
Created `scripts/migrate-data-ownership.js` to fix existing data:
- Finds all staff members
- Migrates their products to admin's userId
- Migrates their sales to admin's userId
- Preserves audit trail by setting `staffId` on sales

## How to Apply the Fix

### Step 1: Run the Migration Script
```bash
node scripts/migrate-data-ownership.js
```

This will:
- Connect to your MongoDB database
- Find all staff members
- Transfer ownership of their products and sales to their admin
- Show a summary of what was migrated

### Step 2: Log Out and Log Back In
All users (admin and staff) need to log out and log back in to get new JWT tokens with the `adminId` field.

### Step 3: Verify
1. Log in as admin/owner → Should now see all inventory and sales
2. Log in as staff → Should still see all inventory and sales (via adminId)
3. Create new products/sales as staff → Should be owned by admin

## Data Model After Migration

### Products
```
userId: <admin's ObjectId>  // Always the shop owner
```

### Sales
```
userId: <admin's ObjectId>   // Always the shop owner
staffId: <staff's ObjectId>  // Which staff member made the sale (if applicable)
```

### Staff
```
userId: <admin's ObjectId>   // Which admin owns this staff member
```

## Benefits
1. ✅ All shop data is centralized under the owner's account
2. ✅ Staff can still access and work with all shop data
3. ✅ Audit trail maintained (staffId tracks who made each sale)
4. ✅ Consistent data ownership model
5. ✅ Admin has full visibility of all operations

## Important Notes
- The migration script is idempotent (safe to run multiple times)
- Existing data is preserved, only ownership is changed
- Staff members retain their login credentials
- No data is deleted, only reassigned
- Sales records get a `staffId` field for tracking

## Testing Checklist
- [ ] Run migration script successfully
- [ ] Admin can see all products
- [ ] Admin can see all sales
- [ ] Staff can see all products
- [ ] Staff can see all sales
- [ ] New products created by staff are owned by admin
- [ ] New sales made by staff are owned by admin
- [ ] Dashboard shows correct statistics for admin
- [ ] Dashboard shows correct statistics for staff
