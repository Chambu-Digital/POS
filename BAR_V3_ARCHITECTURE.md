# Bar System V3 - Complete Architecture Overview

## Executive Summary

The Bar System V3 implements a **reservation-based architecture** that completely separates concerns:

1. **Tab System** = Staging area (what customer wants)
2. **Reservation System** = Temporary holds (prevent overselling)
3. **Checkout System** = Transaction coordinator (execute on payment success)
4. **Inventory Engine** = Side effects (deduct bottles only after payment)

This architecture eliminates the complexity of the previous system while providing better reliability, clearer error handling, and prevention of race conditions.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                        │
│                    (Bar POS Frontend)                        │
└──────────────┬──────────────────────────────┬────────────────┘
               │                              │
               │ Add Item                     │ Checkout
               ↓                              ↓
┌──────────────────────────────┐  ┌──────────────────────────┐
│     TAB MANAGEMENT API       │  │    CHECKOUT API          │
│   /api/bar/tabs-v3/*         │  │  /api/bar/checkout-v3    │
└──────────────┬───────────────┘  └────────┬─────────────────┘
               │                           │
               │ Create                    │ Commit
               │ Reservation               │ Reservations
               ↓                           ↓
┌──────────────────────────────────────────────────────────────┐
│                   RESERVATION ENGINE                          │
│              (lib/bar/reservation-engine.ts)                  │
│                                                              │
│  • checkAvailability()      Check capacity                  │
│  • createReservation()      Reserve fractions (FIFO)        │
│  • commitReservations()     Permanent deduction             │
│  • releaseReservations()    Free capacity                   │
│  • extendReservation()      Reset TTL                       │
│  • cleanupExpired()         Background job                  │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        │ Read/Write
                        ↓
┌──────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                          │
│                                                              │
│  BarReservation    Temporary holds (reserved/committed)     │
│  BarBottle         Physical bottles + reserved fractions    │
│  BarTab            Customer tab metadata                     │
│  BarTabLine        Line items with reservation links        │
│  BarAuditLog       Immutable audit trail                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Complete Sale Lifecycle

### Step 1: User Adds Item to Tab

```
User Action:
"Add 3 tots to Tab #5"

Frontend → Backend:
POST /api/bar/tabs-v3/{tabId}/add-line
{
  inventoryItemId: "vodka_750ml",
  servingId: "tot",
  quantity: 3,
  unitPrice: 150
}

Backend Processing:
1. ReservationEngine.checkAvailability()
   - Query open bottles
   - Sum: available = remaining - reserved
   - Check: 3 tots = 0.15 fraction available?

2a. If SUFFICIENT:
   - ReservationEngine.createReservation()
   - Find oldest bottle (FIFO)
   - Create BarReservation record
   - Update bottle.reservedFraction += 0.15
   - Create BarTabLine linked to reservation
   - Return success

2b. If INSUFFICIENT:
   - Return error with available capacity
   - Frontend shows "Only 2 tots available"

Result:
- Tab has lines
- Bottles have fractions reserved
- No permanent deduction yet
```

### Step 2: User Continues Shopping

```
User Actions:
- Adds more items
- Removes an item
- Changes quantity

Each Action:
- Creates new reservations (add)
- Releases reservations (remove)
- Re-reserves with new quantity (update)

Background:
- Every 5 minutes: cleanup expired reservations
- Reservation TTL: 30 minutes from last interaction
- User interactions auto-extend TTL
```

### Step 3: User Proceeds to Checkout

```
Frontend:
- Navigate to /dashboard/sales/payment
- Pass tab data in session storage

Payment Page:
- Display tab total
- Collect payment method
- Submit payment

POST /api/bar/checkout-v3
{
  tabId: "...",
  paymentMethod: "cash",
  amountPaid: 450
}
```

### Step 4: Backend Processes Payment

```
Checkout Flow:

1. Load tab from database
2. Validate reservations not expired
   - If expired → return error, user must reconfirm

3. Process payment
   - For credit: check customer credit limit
   - For mobile: call M-Pesa API
   - For cash/card: record internal

4. IF payment succeeds:
   ┌─────────────────────────────────────┐
   │ START ATOMIC TRANSACTION            │
   │                                     │
   │ a. Commit all reservations:         │
   │    - Change status: reserved→committed │
   │    - Deduct from bottles:           │
   │      bottle.remainingFraction -= reserved │
   │    - Clear reserved:                │
   │      bottle.reservedFraction = 0    │
   │                                     │
   │ b. Create Sale record               │
   │                                     │
   │ c. Mark tab as paid                 │
   │                                     │
   │ d. Create audit logs                │
   │                                     │
   │ COMMIT TRANSACTION                  │
   └─────────────────────────────────────┘

   Return: { success: true, saleId, bottlesUsed }

5. IF payment fails:
   - Keep reservations intact
   - Return: { error, retryable: true }
   - User can retry with different payment
```

### Step 5: Post-Checkout

```
IF SUCCESS:
- Frontend shows "Payment successful"
- Navigate back to POS
- Tab removed from open tabs list
- Bottles deducted
- Sale appears in reports

IF FAILURE:
- Frontend shows "Payment failed"
- Tab stays open
- Reservations still active (user can retry)
- No bottle deduction
```

---

## Key Design Decisions

### Decision 1: Reservation Before Deduction

**Why:**
- Prevents overselling across concurrent tabs
- Provides immediate feedback to users
- Allows clean rollback on payment failure

**Alternative Rejected:**
Immediate deduction on add-to-tab would require complex rollback logic and couldn't handle concurrent access.

### Decision 2: FIFO Bottle Selection

**Why:**
- Matches bar best practices (use oldest stock first)
- Reduces waste (bottles opened longer consumed faster)
- Simple and predictable

**Alternative Rejected:**
Manual bottle selection on every sale is too slow for busy bars.

### Decision 3: 30-Minute TTL

**Why:**
- Long enough for typical service (order → payment)
- Short enough to free capacity for other customers
- Auto-extends on user interaction

**Alternative Rejected:**
Infinite hold would lock capacity unnecessarily; shorter TTL would expire too often during normal service.

### Decision 4: Commit Only After Payment

**Why:**
- Atomic: inventory changes and payment together
- No orphaned deductions if payment fails
- Clear audit trail

**Alternative Rejected:**
Deducting before payment requires complex reconciliation if payment fails.

### Decision 5: Separate V3 Endpoints

**Why:**
- Allows gradual migration
- Old system continues working
- Can A/B test new system
- Easy rollback if issues

**Alternative Rejected:**
Modifying existing endpoints in-place would break compatibility and prevent rollback.

---

## Concurrency Handling

### Scenario: Two Tabs Compete for Same Bottle

```
Time: 8:00:00.000

Bottle #5 has 0.50 available (10 tots)

Staff A: "Add 8 tots to Tab #1"
Staff B: "Add 8 tots to Tab #2"

Both requests hit server simultaneously
```

**Resolution:**

```
Request A (arrives first):
1. checkAvailability() → 0.50 available ✓
2. createReservation()
   - Lock bottle record (DB transaction)
   - Update reservedFraction: 0.00 → 0.40
   - Release lock
3. Return success

Request B (arrives 10ms later):
1. checkAvailability()
   - Reads bottle: reservedFraction = 0.40
   - Available: 0.50 - 0.40 = 0.10 (2 tots)
2. createReservation() → FAIL
3. Return error: "Only 2 tots available"

Result:
Staff B sees modal: "Only 2 tots available, adjust quantity?"
```

### Database-Level Locking

MongoDB operations are atomic at document level:
```typescript
// This update is atomic - no race condition
await BarBottle.findByIdAndUpdate(bottleId, {
  $inc: { reservedFraction: 0.40 }
})
```

---

## Error Handling Patterns

### Pattern 1: Insufficient Capacity

```
Error Response:
{
  "error": "Only 2 servings available",
  "errorCode": "insufficient_capacity",
  "available": 0.10,
  "availableServings": 2
}

Frontend Action:
┌───────────────────────────────────┐
│ ⚠ Not Enough Available            │
│                                   │
│ Requested: 8 tots                 │
│ Available: 2 tots                 │
│                                   │
│ [Add 2] [Open Bottle] [Cancel]   │
└───────────────────────────────────┘
```

### Pattern 2: Reservation Expired

```
Error Response:
{
  "error": "Some reservations have expired",
  "errorCode": "reservations_expired",
  "expiredCount": 3,
  "retryable": true
}

Frontend Action:
1. Show modal: "Tab was idle, reconfirming availability..."
2. For each line, call add-line API again
3. If any fail → remove from tab, notify user
4. Show updated tab
5. User clicks checkout again
```

### Pattern 3: Payment Failed

```
Error Response:
{
  "error": "Card declined",
  "errorCode": "payment_failed",
  "retryable": true,
  "reservationsValid": true
}

Frontend Action:
┌───────────────────────────────────┐
│ ❌ Payment Failed                 │
│                                   │
│ Card was declined                 │
│                                   │
│ Your items are still reserved     │
│ for 30 minutes                    │
│                                   │
│ [Try Different Card] [Cancel]     │
└───────────────────────────────────┘
```

---

## Performance Considerations

### Database Indexes

**Critical Indexes:**
```javascript
// BarReservation
{ userId: 1, tabId: 1 }                    // Find tab reservations
{ userId: 1, bottleId: 1, status: 1 }      // Calculate capacity
{ status: 1, expiresAt: 1 }                // TTL cleanup

// BarBottle
{ userId: 1, inventoryItemId: 1, state: 1 } // Find open bottles
{ userId: 1, state: 1, openedAt: 1 }        // FIFO ordering
```

### Query Optimization

**Capacity Check (Hot Path):**
```typescript
// Single aggregation query instead of multiple finds
const capacity = await BarBottle.aggregate([
  { $match: { inventoryItemId, state: 'open' } },
  {
    $lookup: {
      from: 'bar_reservations',
      let: { bottleId: '$_id' },
      pipeline: [
        { $match: { 
          $expr: { $eq: ['$bottleId', '$$bottleId'] },
          status: 'reserved'
        }},
        { $group: { _id: null, total: { $sum: '$fractionReserved' } }}
      ],
      as: 'reserved'
    }
  },
  {
    $project: {
      bottleNumber: 1,
      remainingFraction: 1,
      reservedFraction: { $ifNull: [{ $arrayElemAt: ['$reserved.total', 0] }, 0] },
      availableFraction: {
        $subtract: [
          '$remainingFraction',
          { $ifNull: [{ $arrayElemAt: ['$reserved.total', 0] }, 0] }
        ]
      }
    }
  }
])
```

### Caching Strategy

**Cached Fields (Updated on Write):**
- `BarBottle.reservedFraction` - sum of active reservations
- `BarBottle.availableFraction` - remaining - reserved
- `BarTab.reservationsValid` - quick check if expired

**Benefits:**
- Fast reads (no aggregation needed)
- Eventual consistency acceptable (sync job fixes discrepancies)

---

## Monitoring & Observability

### Key Metrics to Track

1. **Reservation Metrics:**
   - Creation rate (reservations/minute)
   - Commit rate (successful checkouts)
   - Release rate (cancellations)
   - Expiry rate (should be < 5%)

2. **Conversion Funnel:**
   ```
   100% - Reservations created
    95% - Still active at 30min
    90% - Reached checkout
    85% - Payment succeeded
   ```

3. **Performance:**
   - Average reservation create time
   - Average commit time
   - Capacity check time (should be < 50ms)

4. **Data Quality:**
   - Discrepancies found by sync job
   - Orphaned reservations
   - Bottles with reserved > remaining

### Logging Points

```typescript
// Log all reservation operations
console.log('[ReservationEngine] Created:', {
  tabId,
  reservationIds,
  fractionReserved,
  bottlesUsed
})

// Log capacity issues
console.warn('[ReservationEngine] Insufficient capacity:', {
  requested,
  available,
  inventoryItemId
})

// Log commits
console.log('[Checkout] Committed reservations:', {
  tabId,
  saleId,
  bottlesDeducted
})
```

---

## Migration Strategy

### Phase 1: Parallel Operation (Week 1-2)

```
Deployment:
- Deploy V3 system alongside V2
- Feature flag: bar_use_v3_system = false (default)
- V2 endpoints unchanged

Testing:
- Enable V3 for admin accounts
- Create test tabs
- Verify all flows work
- Monitor for errors
```

### Phase 2: Gradual Rollout (Week 3-4)

```
Rollout:
- Enable V3 for 20% of users
- Monitor metrics closely
- Compare V2 vs V3 performance
- Gather user feedback

Validation:
- Check reservation expiry rates
- Verify no overselling incidents
- Compare checkout success rates
```

### Phase 3: Full Cutover (Week 5)

```
Cutover:
- Enable V3 for 100% of users
- V2 endpoints marked deprecated
- Monitor for 48 hours
- Keep V2 code for emergency rollback

Success Criteria:
- Zero overselling incidents
- < 5% reservation expiry rate
- > 95% checkout success rate
- No data corruption
```

### Phase 4: Cleanup (Week 6)

```
Cleanup:
- Remove V2 endpoints
- Remove synthetic tab logic
- Archive old components
- Update documentation
- Final performance review
```

---

## Future Enhancements

### Priority 1: Real-time Updates (WebSocket)

Replace polling with WebSocket for:
- Live availability updates
- Reservation expiry warnings
- Bottle state changes

### Priority 2: Smart Bottle Selection

Instead of strict FIFO:
- Consider bottle fill level (prefer nearly empty)
- Group servings from same bottle
- Minimize bottle transitions

### Priority 3: Predictive Reservations

Pre-reserve based on patterns:
- "Table 5 usually orders X"
- "Friday nights need Y capacity"
- Auto-suggest opening bottles before rush

### Priority 4: Analytics Dashboard

Real-time view of:
- Active reservations by product
- Bottleneck products (high demand, low capacity)
- Conversion rates by time of day
- Staff performance metrics

---

## Conclusion

The Bar System V3 provides a **clean, maintainable, and reliable** architecture that:

✅ **Prevents overselling** through temporary reservations  
✅ **Provides immediate feedback** at add-to-cart time  
✅ **Handles concurrent access** safely with DB-level atomicity  
✅ **Enables clean rollback** on payment failures  
✅ **Maintains complete audit trail** for accountability  
✅ **Scales horizontally** with stateless API design  

The system is **production-ready** and has been implemented through Phase 3 (Database, ReservationEngine, APIs). Frontend integration (Phase 4+) can proceed immediately.

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-11  
**Implementation Status:** Phase 1-3 Complete ✅
