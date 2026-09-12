# Bar V3 Migration Guide

## Overview
This guide helps you migrate from the old Bar POS (V2) to the new reservation-based system (V3).

## What's Different?

### Conceptual Changes

**V2 (Old System)**:
- Cart lives in browser
- Tabs can be "synthetic" (not saved until sale)
- Inventory deducted when tab closed
- Possible overselling if multiple cashiers work simultaneously
- Complex state management (cart + tabs + holds)

**V3 (New System)**:
- No cart - everything is a tab
- All tabs are real (saved immediately)
- Reservations prevent overselling
- Inventory deducted only after payment succeeds
- Simple state - just tabs and lines

### Visual Changes

**Main POS Screen**:
- Tab switcher in header (dropdown)
- Cleaner product cards
- Instant feedback on add-to-tab
- Error modals instead of silent failures

**Checkout**:
- Dedicated checkout page
- Clear payment flow
- Success/error screens

---

## Migration Checklist

### Before Migration

#### 1. Close All Open Tabs in V2
```
- Go to existing bar POS
- Close or checkout all open tabs
- Verify no pending holds
- Clear any draft orders
```

#### 2. Verify Bottle Status
```
- Open bar inventory
- Check that bottle states are correct:
  - sealed = not opened yet
  - open = in use
  - empty = finished
- Close or mark empty any bottles that should be
```

#### 3. Backup Data (Admin)
```bash
# Export current bar inventory
curl http://localhost:3000/api/bar/inventory/export > bar_backup_$(date +%Y%m%d).json

# Export open tabs (if any)
curl http://localhost:3000/api/bar/tabs > tabs_backup_$(date +%Y%m%d).json
```

#### 4. Train Staff
```
- Show V3 interface to staff
- Walk through: add item → checkout → payment
- Practice insufficient capacity scenario
- Explain tab switching
```

---

## Step-by-Step Migration

### For Tenant Admins

#### Step 1: Enable V3 (Feature Flag)
Currently, V3 runs at `/dashboard/bar/pos-v3`. Once tested, admins can set a flag to route the main POS url to V3.

**Test V3 First**:
1. Go to `/dashboard/bar/pos-v3`
2. Try a complete sale flow
3. Verify inventory deducted correctly
4. Test tab switching
5. Test insufficient capacity modal

#### Step 2: Background Jobs Setup
V3 requires two background jobs:

**Job 1: Cleanup Expired Reservations**
```typescript
// Run every 5 minutes
// Releases reservations older than 30 minutes
POST /api/bar/reservations/cleanup
```

**Job 2: Sync Reserved Fractions** (optional)
```typescript
// Run every minute
// Recalculates reservedFraction from active reservations
POST /api/bar/bottles/sync-reservations
```

**Setup with cron (if using server cron)**:
```cron
*/5 * * * * curl -X POST http://localhost:3000/api/bar/reservations/cleanup
* * * * * curl -X POST http://localhost:3000/api/bar/bottles/sync-reservations
```

**Setup with Next.js API route**:
Create `/api/cron/bar-maintenance/route.ts`:
```typescript
import { cleanupExpiredReservations } from '@/lib/bar/reservation-engine'

export async function GET(req: Request) {
  // Verify cron secret
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await cleanupExpiredReservations()
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: 'Failed' }, { status: 500 })
  }
}
```

Then setup on Vercel/hosting platform cron.

#### Step 3: Enable for All Users
Once tested, redirect main POS route:

**Option A: Update route (simple)**
```typescript
// app/dashboard/bar/pos/page.tsx
import { redirect } from 'next/navigation'

export default function BarPOSPage() {
  redirect('/dashboard/bar/pos-v3')
}
```

**Option B: Feature flag (gradual)**
```typescript
// app/dashboard/bar/pos/page.tsx
import { getTenantSetting } from '@/lib/tenant/settings'
import { redirect } from 'next/navigation'

export default async function BarPOSPage() {
  const useV3 = await getTenantSetting('bar_use_v3_system')
  
  if (useV3) {
    redirect('/dashboard/bar/pos-v3')
  }
  
  // Load V2
  return <BarPOSV2 />
}
```

---

## Training Guide for Staff

### Quick Start Guide

#### Opening the POS
1. Go to Bar → POS
2. System creates "Quick Sale" tab automatically
3. Start adding items

#### Adding Items
**For full bottles**:
- Click the "Full Bottle" button on product card

**For servings**:
- Click the serving button (e.g., "Shot", "Pint")

**Result**:
- Item added immediately
- Toast shows: "Added to tab - Using Bottle #123"

#### If "Not Enough Available" appears
**This means**: Not enough servings in open bottles

**Your options**:
1. **Add partial** - Add what's available (e.g., add 3 instead of 5)
2. **Open bottle** - Go open a new bottle first
3. **Cancel** - Don't add anything

**Example**:
- Customer wants 5 shots
- Only 3 servings left in open bottle
- Click "Add 3 servings"
- Then open new bottle for next order

#### Managing Quantities
- **Increase**: Click `+` button
- **Decrease**: Click `-` button
- **Remove**: Click `X` button

#### Multiple Tabs
**Creating a tab**:
1. Click tab dropdown (top right)
2. Click "New Tab"
3. Enter customer name (e.g., "Table 5")
4. Click "Create Tab"

**Switching tabs**:
1. Click tab dropdown
2. Select the tab you want
3. Items stay in their original tabs

#### Checkout
1. Click "Proceed to Checkout"
2. Select payment mode:
   - Cash
   - M-Pesa (needs confirmation code)
   - Card (needs reference)
   - Credit
3. Enter amount paid
4. Click "Complete Payment"
5. Done! System deducts inventory automatically

---

## Common Scenarios

### Scenario 1: Single Customer (Quick Sale)
**Old way (V2)**:
- Add items to cart
- Click "Quick Sale"
- Select payment
- Done

**New way (V3)**:
- Add items (auto-creates Quick Sale tab)
- Click "Checkout"
- Select payment
- Done

**Difference**: Same flow, just one less step

---

### Scenario 2: Multiple Customers (Tabs)
**Old way (V2)**:
- Create tab for Table 1
- Add items
- Create tab for Table 2
- Add items
- Switch between tabs to checkout

**New way (V3)**:
- Click "New Tab" → Enter "Table 1"
- Add items
- Click "New Tab" → Enter "Table 2"
- Add items
- Switch using tab dropdown
- Checkout each tab

**Difference**: Tab creation is clearer, switching is easier

---

### Scenario 3: Not Enough Servings
**Old way (V2)**:
- Add 5 shots
- System says "Not enough stock"
- You don't know why (maybe 100 bottles sealed)
- Manual investigation needed

**New way (V3)**:
- Add 5 shots
- Modal: "3 available" (clear message)
- Options: Add 3, or Open Bottle
- Click decision
- Continue

**Difference**: Clear feedback, immediate resolution

---

### Scenario 4: Opening a Bottle
**V2**: Go to Inventory → Find bottle → Click "Open"

**V3**: Same! (No change)

**However**: V3 shows clearer capacity when adding servings

---

## Troubleshooting for Staff

### "No tab selected for checkout"
**Cause**: Something cleared your session
**Fix**: Click "Back to POS", your items should still be there

---

### Modal keeps saying "Not Enough Available"
**Possible causes**:
1. Someone else is using that bottle in another tab
2. Bottle is almost empty

**Fix**:
1. Check other open tabs
2. Checkout those tabs first, OR
3. Open a new bottle

---

### Customer total seems wrong
**Cause**: Confusion between old/new system
**Fix**: 
1. Look at the "Current Tab" panel on right
2. Verify each line
3. If wrong, remove and re-add

---

### Can't find a tab I created
**Cause**: Tab might have been checked out
**Fix**: Check "Reports" for recent sales

---

## Rollback Plan (Admin)

If V3 causes issues, you can roll back:

### Quick Rollback
```typescript
// app/dashboard/bar/pos/page.tsx
import { redirect } from 'next/navigation'

export default function BarPOSPage() {
  // Comment out to go back to V2
  // redirect('/dashboard/bar/pos-v3')
  
  return <BarPOSV2 />
}
```

### Data Cleanup After Rollback
V3 reservations won't affect V2, but cleanup is good practice:

```typescript
// Release all reservations
await BarReservation.updateMany(
  { status: 'reserved' },
  { status: 'released' }
)

// Reset reserved fractions
await BarBottle.updateMany(
  {},
  { reservedFraction: 0 }
)
```

---

## Benefits of V3

### For Staff
- Faster workflow (fewer clicks)
- Clear error messages
- No overselling accidents
- Better tab management

### For Management
- Accurate inventory tracking
- Audit trail (reservation logs)
- Prevent revenue loss (no overselling)
- Better reporting (reservation analytics)

### For Customers
- Faster service
- Accurate availability information
- No "sorry, we're out" after ordering

---

## Timeline

### Week 1: Testing
- Install V3
- Admin tests all flows
- Staff training sessions

### Week 2: Soft Launch
- V3 available at `/pos-v3`
- Staff use during quiet hours
- Collect feedback

### Week 3: Full Launch
- Route main POS to V3
- Monitor for issues
- V2 still available as fallback

### Week 4: Stabilization
- Fix any issues
- Optimize based on usage
- Remove V2 if all good

---

## Support

### For Technical Issues
- Check `/BAR_V3_TROUBLESHOOTING.md`
- Review API logs
- Contact developer

### For Training
- Review this guide
- Watch walkthrough video (if available)
- Practice with test data

### For Feedback
- Document what works well
- Note any confusing parts
- Suggest improvements

---

## FAQ

**Q: Do I need to re-enter all my products?**
A: No, V3 uses the same product database

**Q: What happens to my old tabs?**
A: Close them in V2 before switching to V3

**Q: Can I use both systems?**
A: Not recommended - stick to one to avoid confusion

**Q: Is training required?**
A: Yes, at least 30 min walkthrough

**Q: What if I make a mistake?**
A: Tabs can be modified before checkout. After checkout, use "Return Sale" as before

**Q: Do reservations cost me money?**
A: No, they're free. They just prevent overselling

**Q: What if reservation expires?**
A: Rare (30min timeout), but if it happens, re-add the item

**Q: Can customers see reservations?**
A: No, it's internal. They just see normal POS

**Q: Does this work offline?**
A: No, requires internet like V2

**Q: Can I customize the timeout?**
A: Yes, admin can adjust in settings

---

## Success Metrics

Track these to measure migration success:

- **Overselling incidents**: Should drop to 0
- **Staff error rate**: Should decrease
- **Average checkout time**: Should decrease
- **Customer satisfaction**: Should increase
- **Inventory accuracy**: Should improve

---

## Conclusion

V3 is simpler, safer, and faster than V2. The migration requires initial training but pays off in reduced errors and better operations.

**Remember**: Start with testing, train your team, then go live gradually.
