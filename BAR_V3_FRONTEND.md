# Bar V3 Frontend Implementation

## Overview
The Bar V3 frontend is a complete rewrite that leverages the reservation-based architecture to provide a clean, simplified POS experience.

## Components Created

### 1. `/app/dashboard/bar/pos-v3/page.tsx`
**Purpose**: Main POS interface for bar sales

**Key Features**:
- Auto-creates/loads "Quick Sale" tab on mount
- Real-time product catalog with search and category filtering
- Barcode scanner integration
- Immediate reservation on add-to-tab
- Visual feedback for insufficient capacity
- Tab line management (add/remove/update quantity)
- Clean error handling with modals

**State Management**:
```typescript
- products: BarProduct[]              // Product catalog
- currentTab: CurrentTab | null       // Active tab being worked on
- tabLines: TabLine[]                 // Lines in current tab
- insufficientModal: { ... }          // Modal state for capacity errors
```

**Key Functions**:
- `initializeTab()` - Auto-create or load Quick Sale tab
- `addToTab()` - Add item with immediate reservation
- `updateLineQuantity()` - Update with capacity check
- `removeLineFromTab()` - Remove and release reservation
- `goToCheckout()` - Navigate to payment page

**Error Handling**:
- Insufficient capacity → Show modal with options (add partial / open bottle)
- Reservation failure → Toast error with details
- API errors → Toast + console.error

---

### 2. `/components/bar/tab-switcher.tsx`
**Purpose**: Dropdown for managing multiple tabs

**Key Features**:
- Lists all open tabs with totals
- Switch between tabs instantly
- Create new named tabs
- Shows item count and total per tab
- Auto-refreshes on tab creation

**UI Flow**:
1. Click dropdown → Shows all open tabs
2. Click "New Tab" → Modal opens
3. Enter customer name (required), table number (optional)
4. Tab created → Auto-switch to new tab

**API Calls**:
- `GET /api/bar/tabs-v3?status=open` - Load all tabs
- `POST /api/bar/tabs-v3/create` - Create new tab

---

### 3. `/components/bar/insufficient-capacity-modal.tsx`
**Purpose**: Handle insufficient bottle capacity gracefully

**Shown When**:
- User tries to add more servings than available in open bottles
- API returns `insufficient_capacity` error

**User Options**:
1. **Add Partial** - Add only what's available (e.g., add 3 instead of 5)
2. **Open Bottle** - Navigate to inventory page to open a new bottle
3. **Cancel** - Close modal, nothing added

**Props**:
```typescript
{
  open: boolean
  productName: string
  servingName?: string
  requested: number          // What user asked for
  available: number          // What's actually available
  onAddPartial: () => void
  onOpenBottle: () => void
  onClose: () => void
}
```

---

### 4. `/app/dashboard/bar/checkout-v3/page.tsx`
**Purpose**: Handle payment and finalize tab

**Flow**:
1. Load tab from `sessionStorage.checkoutTabId`
2. Show order summary + payment form
3. Validate payment details
4. Call `POST /api/bar/checkout-v3`
5. On success: Show success screen → Redirect to POS
6. On failure: Show error, keep reservations active

**Payment Modes**:
- **Cash** - Amount paid (shows change if overpaid)
- **M-Pesa** - Requires confirmation code
- **Card** - Requires reference number
- **Credit** - On account

**States**:
- `loading` - Initial tab load
- `processing` - Payment in progress
- `checkoutComplete` - Success screen
- `checkoutError` - Error message

**Validation**:
- Amount paid must be ≥ total
- M-Pesa mode requires confirmation code
- Card mode requires reference

**API Call**:
```typescript
POST /api/bar/checkout-v3
{
  tabId: string
  paymentMode: 'cash' | 'mpesa' | 'card' | 'credit'
  amountPaid: number
  mpesaCode?: string
  cardReference?: string
}
```

**Success Response**:
```json
{
  "success": true,
  "saleId": "6789...",
  "deductions": [...]
}
```

---

## User Flows

### Quick Sale Flow (Most Common)
1. Open POS → Auto-loads "Quick Sale" tab
2. Search/browse products
3. Click serving or bottle → Added instantly
4. Success toast shows bottle number used
5. Click "Proceed to Checkout"
6. Select payment mode
7. Enter amount + details
8. Click "Complete Payment"
9. Success screen → Back to POS

### Multi-Tab Flow
1. Open POS → "Quick Sale" loaded
2. Click tab dropdown → "New Tab"
3. Enter customer name (e.g., "Table 5")
4. Add items to tab
5. Switch to another tab
6. Add items to that tab
7. Switch back, checkout first tab
8. Repeat for others

### Insufficient Capacity Flow
1. Try to add 5 servings
2. Only 3 available
3. Modal appears: "Not Enough Available"
4. Options:
   - Add 3 servings ✓
   - Open new bottle
   - Cancel
5. User clicks "Add 3 servings"
6. Items added successfully

### Scan Barcode Flow
1. Focus barcode input (top of POS)
2. Scan barcode
3. Product found → Added as full bottle
4. Toast confirmation

---

## Key Differences from V2

| Aspect | V2 (Old) | V3 (New) |
|--------|----------|----------|
| **Cart** | Local state cart | Server-side tabs only |
| **Tabs** | Mix of real & synthetic | All tabs are real |
| **Reservations** | None (overselling possible) | Immediate on add |
| **Inventory** | Deducted on tab close | Deducted on payment |
| **Complexity** | ~800 lines, 3 states | ~400 lines, 1 state |
| **Error Handling** | Silent failures | Clear modals + toasts |
| **Bottle Selection** | Manual every time | Auto-FIFO + modal if needed |

---

## Data Flow

### Adding Item to Tab
```
User clicks serving
  ↓
POST /api/bar/tabs-v3/{id}/add-line
  ↓
ReservationEngine.createReservation()
  ↓
Check capacity → Reserve fraction → Create line
  ↓
Response: { line, reservation, bottlesUsed }
  ↓
UI: Reload tab + Show toast
```

### Checkout
```
User clicks "Complete Payment"
  ↓
POST /api/bar/checkout-v3
  ↓
Validate reservations still valid
  ↓
Create Sale record
  ↓
Commit reservations (deduct inventory)
  ↓
Close tab
  ↓
Response: { saleId, deductions }
  ↓
UI: Show success + redirect
```

### Error: Insufficient Capacity
```
User clicks "Add 5 servings"
  ↓
POST /api/bar/tabs-v3/{id}/add-line
  ↓
Check capacity: only 3 available
  ↓
Response: 400 { errorCode: 'insufficient_capacity', available: 3 }
  ↓
UI: Open modal with options
  ↓
User clicks "Add 3"
  ↓
Retry with quantity: 3
  ↓
Success
```

---

## Testing Checklist

### Basic Operations
- [ ] POS loads with Quick Sale tab
- [ ] Search products works
- [ ] Filter by category works
- [ ] Add full bottle to tab
- [ ] Add serving to tab
- [ ] Remove item from tab
- [ ] Increase quantity
- [ ] Decrease quantity
- [ ] Go to checkout
- [ ] Complete payment (cash)
- [ ] Complete payment (M-Pesa)
- [ ] Complete payment (card)

### Tab Management
- [ ] Create new tab
- [ ] Switch between tabs
- [ ] Items stay in correct tab
- [ ] Dropdown shows all open tabs
- [ ] Tab totals display correctly

### Error Scenarios
- [ ] Try to add 10 servings when only 3 available → Modal appears
- [ ] Click "Add 3" → Items added
- [ ] Click "Open Bottle" → Navigate to inventory
- [ ] Try to checkout empty tab → Error toast
- [ ] Payment amount less than total → Error

### Barcode Scanner
- [ ] Scan known barcode → Product added
- [ ] Scan unknown barcode → Error toast
- [ ] Manual entry works

### Edge Cases
- [ ] Add item, then another user closes the bottle → Shows error on checkout
- [ ] Reservation expires (after 30min) → Shows error on checkout
- [ ] Network error during checkout → Error shown, tab unchanged
- [ ] Overpaid amount → Change calculated correctly

---

## Performance Notes

### Optimizations
- Products loaded once on mount
- Tab reloaded only after mutations
- No polling (future: WebSocket for real-time updates)
- Filtered products computed on each search/filter change

### Future Improvements
- Real-time availability badges per product
- WebSocket updates when bottles opened/closed
- Reservation expiry warnings (toast at 5min remaining)
- Optimistic UI updates (add before API confirms)

---

## Styling

### Design System
- Shadcn UI components (consistent with rest of app)
- Tailwind for layout and spacing
- Custom icons for bottle/serving selection
- Color coding: Primary (success), Yellow (warnings), Red (errors)

### Responsive
- Mobile: Single column, stacked panels
- Tablet: Products list + sidebar
- Desktop: 2/3 products, 1/3 tab

### Accessibility
- Keyboard navigation supported
- ARIA labels on icon buttons
- Focus management in modals
- Screen reader friendly

---

## Migration Strategy

### Phase 1: Parallel Operation (Current)
- V2 at `/dashboard/bar/pos`
- V3 at `/dashboard/bar/pos-v3`
- Both functional, users can test V3

### Phase 2: Feature Flag
- Add tenant setting: `bar_use_v3_system`
- Route `/dashboard/bar/pos` based on flag
- Gradual rollout per tenant

### Phase 3: Full Migration
- All tenants on V3
- Remove V2 code
- Rename `/pos-v3` → `/pos`
- Deprecate old API endpoints

---

## Troubleshooting

### "No tab selected for checkout"
**Cause**: Session storage cleared or expired
**Fix**: Click "Back to POS", items should still be in tab

### "Insufficient capacity" modal keeps appearing
**Cause**: Another tab has reservations on the same bottle
**Fix**: Open a new bottle or checkout the other tab first

### Tab shows wrong total
**Cause**: Client state out of sync
**Fix**: Refresh page, tab loads from server

### Payment completes but inventory not deducted
**Cause**: Checkout succeeded but deduction failed (rare)
**Fix**: Check Sale record, manually adjust inventory if needed

---

## Next Steps

### Immediate
1. Test complete flow end-to-end
2. Add real-time availability badges
3. Setup background jobs (cleanup expired reservations)
4. Add reservation expiry warnings

### Short-term
1. Reservation analytics dashboard
2. Bulk checkout (close multiple tabs at once)
3. Split payment support
4. Customer credit account integration

### Long-term
1. Mobile app for waiters (order taking)
2. KDS integration (bar orders)
3. Inventory forecasting based on reservation patterns
4. Multi-location reservation sync
