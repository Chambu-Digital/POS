# Quick Start: Fix Data Ownership Issue

## What's the Problem?
Your admin/owner account shows 0 inventory and 0 sales, but staff accounts show all the data.

## Quick Fix (3 Steps)

### Step 1: Run the Migration Script
Open your terminal in the project directory and run:

```bash
node scripts/migrate-data-ownership.js
```

**Expected Output:**
```
🚀 Starting data ownership migration...
🔄 Connecting to MongoDB...
✅ Connected to MongoDB

📋 Found X staff members

👤 Processing staff: [Staff Name] ([Email])
   📦 Products migrated: X
   💰 Sales migrated: X

==================================================
✅ Migration completed successfully!
==================================================
📦 Total products migrated: X
💰 Total sales migrated: X
```

### Step 2: Log Out All Users
1. Log out from all admin accounts
2. Log out from all staff accounts
3. Close all browser tabs with the POS system

### Step 3: Log Back In and Verify
1. **Log in as Admin/Owner**
   - ✅ Should now see all products in inventory
   - ✅ Should see all sales in dashboard
   - ✅ Dashboard statistics should be correct

2. **Log in as Staff**
   - ✅ Should still see all products
   - ✅ Should still see all sales
   - ✅ Can make new sales normally

## That's It!
Your data ownership is now fixed. All products and sales belong to the shop owner, and staff can access them through their admin link.

## If Something Goes Wrong
1. Check that your `.env` file has the correct `MONGODB_URI`
2. Make sure you're in the project root directory when running the script
3. Ensure you have Node.js installed
4. Check the console output for specific error messages

## Need Help?
Read the full details in `MIGRATION-SUMMARY.md`
