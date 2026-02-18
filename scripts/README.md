# Migration Scripts

## migrate-data-ownership.js

### Purpose
This script fixes the data ownership issue where products and sales were incorrectly tied to staff member accounts instead of the shop owner's account.

### What it does
1. Finds all staff members in the database
2. For each staff member:
   - Migrates all products from staff userId to admin userId
   - Migrates all sales from staff userId to admin userId
   - Sets the `staffId` field on sales to track which staff member made the sale

### When to run
Run this script **once** after updating the API routes to fix existing data in your database.

### How to run

```bash
node scripts/migrate-data-ownership.js
```

### Prerequisites
- Node.js installed
- MongoDB connection string in `.env` file
- `mongoose` package installed

### What to expect
The script will output:
- Number of staff members found
- For each staff member:
  - Number of products migrated
  - Number of sales migrated
- Total summary of all migrations

### Safety
- The script only updates records that belong to staff members
- It preserves all other data
- Sales records get a `staffId` field to maintain audit trail
- Can be run multiple times safely (idempotent)

### After running
1. Log out and log back in to all accounts
2. Verify that admin/owner accounts now see all inventory and sales
3. Verify that staff accounts still see the same data (now via adminId)
