# Bar System V3 - Reservation-Based Architecture

## Implementation Status: Phase 1, 2, 3 Complete ✅

This document summarizes the completed implementation of the reservation-based bar sales system.

---

## What Was Implemented

### Phase 1: Database Layer ✅

**New Schema: `BarReservation`**
- Tracks temporary holds on bottle fractions
- Prevents overselling across concurrent tabs
- Auto-expires after 30 minutes (TTL)
- States: reserved → committed/released/expired

**Updated Schemas:**
- `BarBottle`: Added `reservedFraction`, `availableFraction`, `lastReservationCheck`
- `BarTab`: Added `reservationIds[]`, `reservationsValid`
- `BarTabLine`: Added `reservationId`, `discount`

**Location:** `lib/models/schemas.ts`

---

### Phase 2: ReservationEngine ✅

**Core Module:** `lib/bar/reservation-engine.ts`

**Key Functions:**
1. `checkAvailability()` - Check capacity without creating reservation
2. `createReservation()` - Reserve fractions when adding to tab (FIFO allocation)
3. `commitReservations()` - Permanent deduction on payment success
4. `releaseReservations()` - Free capacity on payment failure/cancellation
5. `extendReservation()` - Reset TTL on tab interaction
6. `getReservationSummary()` - View reservation details for a tab
7. `cleanupExpiredReservations()` - Background job for TTL cleanup
8. `syncBottleReservedFractions()` - Background job for data integrity

**Features:**
- FIFO bottle selection (oldest first)
- Multi-bottle spanning (if single bottle insufficient)
- Atomic operations (all-or-nothing)
- Detailed error codes and availability feedback

---

### Phase 3: API Endpoints ✅

**Reservation Management:**
- `POST /api/bar/reservations/create` - Create reservation
- `GET /api/bar/reservations/check-availability` - Check capacity
- `POST /api/bar/reservations/release` - Release reservations
- `POST /api/bar/reservations/extend` - Extend TTL
- `GET /api/bar/reservations/summary` - Get tab reservations

**Tab Management (V3):**
- `POST /api/bar/tabs-v3/create` - Create new tab
- `GET /api/bar/tabs-v3` - List tabs (with status filter)
- `GET /api/bar/tabs-v3/[id]` - Get tab details with lines
- `POST /api/bar/tabs-v3/[id]/add-line` - Add item (creates reservation)
- `DELETE /api/bar/tabs-v3/[id]/lines/[lineId]` - Remove item (releases reservation)
- `PATCH /api/bar/tabs-v3/[id]/lines/[lineId]` - Update quantity (re-reserves)

**Checkout:**
- `POST /api/bar/checkout-v3` - Process payment and commit reservations

**All endpoints include:**
- Authentication checks
- Error handling with detailed codes
- Audit logging
- Transaction safety

---

## How The System Works

### Flow 1: Adding Item to Tab

```
1. User clicks "Add Tot" on product card
   ↓
2. Frontend calls POST /api/bar/tabs-v3/[id]/add-line
   ↓
3. Backend creates reservation via ReservationEngine
   ↓
4a. SUCCESS: Creates BarTabLine, links reservation
4b. FAILURE: Returns error with available capacity
   ↓
5. Frontend shows item in tab OR shows "Only X available" modal
```

### Flow 2: Checkout & Payment

```
1. User clicks "Checkout" button
   ↓
2. Frontend navigates to payment page
   ↓
3. User enters payment details, submits
   ↓
4. Backend calls POST /api/bar/checkout-v3
   ↓
5. Validate reservations not expired
   ↓
6. Commit reservations (deduct from bottles)
   ↓
7. Create Sale record
   ↓
8. Mark tab as paid
   ↓
9. Return success with bottle usage details
```

### Flow 3: Payment Failure

```
1. Payment processor declines
   ↓
2. Reservations stay intact (not released)
   ↓
3. User sees "Payment failed, items still reserved for 30min"
   ↓
4. User can retry with different payment method
```

### Flow 4: Reservation Expiry

```
1. Tab open for > 30 minutes without interaction
   ↓
2. Background job finds expired reservations
   ↓
3. Auto-releases them (frees capacity)
   ↓
4. Next user interaction shows "Some items expired, reconfirm"
   ↓
5. Frontend re-checks availability, adjusts if needed
```

---

## Key Benefits

### ✅ Prevents Overselling
Multiple tabs cannot reserve the same fraction. First-come, first-served.

### ✅ Immediate Feedback
User knows instantly if item available (not at payment time).

### ✅ Clean Error Recovery
Payment failure just releases reservations. No complex rollback.

### ✅ Tab Independence
Each tab holds its own reservations. No interference.

### ✅ Auto-Recovery
Abandoned tabs auto-release after TTL. No manual cleanup.

### ✅ Atomic Transactions
Bottle deductions only happen AFTER payment succeeds.

### ✅ Complete Audit Trail
Every reservation creation/commit/release logged.

---

## API Usage Examples

### Create Tab

```typescript
POST /api/bar/tabs-v3/create

Body:
{
  "customerName": "John Doe",
  "tableNumber": "5",
  "notes": "Birthday party"
}

Response:
{
  "tab": {
    "_id": "...",
    "tabNumber": "BAR-123",
    "customerName": "John Doe",
    "status": "open",
    "reservationIds": [],
    ...
  }
}
```

### Add Item to Tab

```typescript
POST /api/bar/tabs-v3/{tabId}/add-line

Body:
{
  "inventoryItemId": "...",
  "servingId": "...",
  "itemName": "Smirnoff 750ml",
  "servingName": "Tot",
  "quantity": 3,
  "unitPrice": 150,
  "discount": 0
}

Response (Success):
{
  "success": true,
  "line": { ... },
  "reservation": {
    "reservationIds": ["..."],
    "bottlesUsed": [
      {
        "bottleId": "...",
        "bottleNumber": 5,
        "fractionReserved": 0.15
      }
    ]
  },
  "updatedTab": {
    "subtotal": 450,
    "total": 450
  }
}

Response (Insufficient Capacity):
{
  "error": "Only 2 servings available",
  "errorCode": "insufficient_capacity",
  "available": 0.10,
  "availableServings": 2
}
```

### Check Availability

```typescript
GET /api/bar/reservations/check-availability?inventoryItemId=...&servingId=...&quantity=5

Response:
{
  "available": true,
  "capacity": 0.85,
  "capacityServings": 17,
  "bottles": [
    {
      "bottleId": "...",
      "bottleNumber": 5,
      "availableFraction": 0.35,
      "availableServings": 7
    },
    {
      "bottleId": "...",
      "bottleNumber": 6,
      "availableFraction": 0.50,
      "availableServings": 10
    }
  ]
}
```

### Checkout

```typescript
POST /api/bar/checkout-v3

Body:
{
  "tabId": "...",
  "paymentMethod": "cash",
  "amountPaid": 450
}

Response (Success):
{
  "success": true,
  "saleId": "...",
  "orderNumber": "BAR-00042",
  "tabId": "...",
  "bottlesUsed": [
    {
      "bottleId": "...",
      "bottleNumber": 5,
      "newRemainingFraction": 0.20
    }
  ]
}

Response (Expired):
{
  "error": "Some reservations have expired",
  "errorCode": "reservations_expired",
  "expiredCount": 2,
  "retryable": true,
  "message": "Tab was idle too long. Please review items and try again."
}
```

---

## Background Jobs Required

### Job 1: Reservation Cleanup (Every 5 minutes)

```typescript
import { ReservationEngine } from '@/lib/bar/reservation-engine'

async function cleanupExpiredReservations() {
  const conn = await getTenantConnection()
  const result = await ReservationEngine.cleanupExpiredReservations(conn)
  console.log(`Released ${result.releasedCount} expired reservations`)
}
```

### Job 2: Bottle Capacity Sync (Every 1 minute)

```typescript
async function syncBottleCapacity() {
  const conn = await getTenantConnection()
  const result = await ReservationEngine.syncBottleReservedFractions(conn)
  console.log(`Synced ${result.bottlesSynced} bottles, found ${result.discrepanciesFound} discrepancies`)
}
```

---

## Migration Notes

### Existing System Compatibility

The V3 system is **fully backward compatible**:
- Old endpoints still work (though deprecated)
- Existing BarTab/BarTabLine records unaffected
- Can run V2 and V3 in parallel (feature flag)

### Migration Path

**Option A: Gradual Migration**
1. Deploy V3 endpoints alongside V2
2. Update frontend to use V3 for new tabs
3. Let existing V2 tabs complete naturally
4. After 2 weeks, deprecate V2 endpoints

**Option B: Instant Cutover**
1. Deploy V3 system
2. Close all open V2 tabs (force checkout or mark abandoned)
3. Switch frontend to V3 only
4. Remove V2 code after 1 week monitoring

### Data Migration Script

For converting existing open tabs to V3 (if needed):

```typescript
// Create reservations for all open V2 tabs
async function migrateV2TabsToV3() {
  const openTabs = await BarTab.find({ status: 'open' })
  
  for (const tab of openTabs) {
    const lines = await BarTabLine.find({ tabId: tab._id, voided: false })
    
    for (const line of lines) {
      // Create reservation retroactively
      await ReservationEngine.createReservation({
        tabId: tab._id,
        inventoryItemId: line.inventoryItemId,
        servingId: line.servingId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        staffId: tab.staffId,
      }, conn)
    }
  }
}
```

---

## Testing Checklist

### Unit Tests Needed
- ✅ ReservationEngine.checkAvailability()
- ✅ ReservationEngine.createReservation() - success case
- ✅ ReservationEngine.createReservation() - insufficient capacity
- ✅ ReservationEngine.commitReservations()
- ✅ ReservationEngine.releaseReservations()
- ✅ ReservationEngine.cleanupExpiredReservations()
- ✅ Multi-bottle spanning logic

### Integration Tests Needed
- ✅ Create tab → add lines → checkout → success
- ✅ Create tab → add lines → payment fails → retry succeeds
- ✅ Two tabs competing for same bottle capacity
- ✅ Reservation expiry after 30 minutes
- ✅ Line removal releases reservation
- ✅ Line quantity update re-reserves correctly

### Load Tests Needed
- ✅ 10 concurrent tabs adding items simultaneously
- ✅ 50 open tabs with active reservations
- ✅ Rapid reservation expiry/renewal cycles

---

## Next Steps (Phase 4+)

### Phase 4: Frontend Rebuild
- Simplify POS component (remove synthetic tab logic)
- Add real-time availability display
- Show reservation expiry warnings
- Handle insufficient capacity modals

### Phase 5: Error Handling & Polish
- Expired reservation recovery flow
- Payment failure retry UX
- Bottle selection hints (which bottle using)
- Reservation dashboard for admins

### Phase 6: Reporting
- Reservation metrics (creation/commit/release rates)
- Bottle utilization analytics
- Conversion funnel (reserved → committed)
- Expired reservation tracking

---

## Configuration

### Reservation TTL

Default: 30 minutes

To change, edit `lib/bar/reservation-engine.ts`:

```typescript
const RESERVATION_TTL_MINUTES = 30  // Change this value
```

### Background Job Schedule

Recommended cron schedule:
```
Cleanup:     */5 * * * *  (every 5 minutes)
Capacity Sync: */1 * * * *  (every 1 minute)
```

---

## Troubleshooting

### "Insufficient capacity" but bottles show as available

**Cause:** Cached `reservedFraction` out of sync

**Fix:** Run capacity sync job manually:
```typescript
await ReservationEngine.syncBottleReservedFractions(conn)
```

### Reservations stuck in "reserved" state

**Cause:** Payment succeeded but commit failed

**Fix:** Manual commit script:
```typescript
await ReservationEngine.commitReservations(tabId, conn)
```

### Too many reservations expiring

**Cause:** TTL too short for typical service speed

**Fix:** Increase `RESERVATION_TTL_MINUTES` to 45 or 60

---

## Support

For questions or issues with this implementation:
1. Check logs: `[bar/checkout-v3]`, `[ReservationEngine]`
2. Review audit logs: `BarAuditLog` collection
3. Check reservation state: `GET /api/bar/reservations/summary?tabId=...`

---

**Implementation Date:** 2026-09-11  
**Version:** 3.0.0  
**Status:** Phase 1, 2, 3 Complete - Ready for Frontend Integration
