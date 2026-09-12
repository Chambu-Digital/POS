# Bar System V3 - API Quick Reference

## Base URL
All endpoints are prefixed with your application's base URL.

---

## Reservation Management

### Check Availability
**GET** `/api/bar/reservations/check-availability`

Check if sufficient capacity exists without creating a reservation.

**Query Parameters:**
- `inventoryItemId` (required) - Product ID
- `servingId` (optional) - Serving ID for serving sales
- `quantity` (required) - Number of servings/bottles

**Response:**
```json
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
    }
  ]
}
```

---

### Create Reservation
**POST** `/api/bar/reservations/create`

Reserve fractions when adding item to tab.

**Body:**
```json
{
  "tabId": "...",
  "inventoryItemId": "...",
  "servingId": "...",  // optional
  "quantity": 3,
  "unitPrice": 150
}
```

**Success Response (201):**
```json
{
  "success": true,
  "reservationIds": ["..."],
  "bottlesUsed": [
    {
      "bottleId": "...",
      "bottleNumber": 5,
      "fractionReserved": 0.15
    }
  ]
}
```

**Error Response (400):**
```json
{
  "error": "Only 2 servings available",
  "errorCode": "insufficient_capacity",
  "available": 0.10,
  "availableServings": 2
}
```

**Error Codes:**
- `insufficient_capacity` - Not enough available
- `no_bottles_open` - No open bottles for this product
- `invalid_quantity` - Quantity must be >= 1
- `bottle_not_found` - Serving or product not found

---

### Release Reservations
**POST** `/api/bar/reservations/release`

Free up reserved capacity (item removed or payment failed).

**Body:**
```json
{
  "reservationIds": ["...", "..."],  // OR
  "tabId": "...",                    // Release all for tab
  "reason": "Payment failed"
}
```

**Response:**
```json
{
  "success": true,
  "fractionsReleased": 0.25,
  "reservationsReleased": 3
}
```

---

### Extend Reservation TTL
**POST** `/api/bar/reservations/extend`

Reset expiry time (called on tab interaction).

**Body:**
```json
{
  "tabId": "..."
}
```

**Response:**
```json
{
  "success": true,
  "newExpiresAt": "2026-09-11T15:30:00Z"
}
```

---

### Get Reservation Summary
**GET** `/api/bar/reservations/summary`

View all reservations for a tab.

**Query Parameters:**
- `tabId` (required)

**Response:**
```json
{
  "reservations": [
    {
      "_id": "...",
      "bottleId": { "_id": "...", "bottleNumber": 5 },
      "inventoryItemId": { "name": "Smirnoff 750ml" },
      "servingId": { "name": "Tot" },
      "fractionReserved": 0.15,
      "quantity": 3,
      "status": "reserved",
      "expiresAt": "2026-09-11T15:30:00Z"
    }
  ],
  "totalFraction": 0.35,
  "bottlesInvolved": 2,
  "earliestExpiry": "2026-09-11T15:30:00Z"
}
```

---

## Tab Management (V3)

### Create Tab
**POST** `/api/bar/tabs-v3/create`

Create new empty tab.

**Body:**
```json
{
  "customerName": "John Doe",
  "tableNumber": "5",
  "notes": "Birthday party"
}
```

**Response (201):**
```json
{
  "tab": {
    "_id": "...",
    "tabNumber": "BAR-123",
    "customerName": "John Doe",
    "tableNumber": "5",
    "status": "open",
    "subtotal": 0,
    "total": 0,
    "openedAt": "2026-09-11T14:00:00Z"
  }
}
```

---

### List Tabs
**GET** `/api/bar/tabs-v3`

List tabs with optional status filter.

**Query Parameters:**
- `status` (optional) - Filter by status: `open`, `hold`, `billing`, `paid`

**Response:**
```json
{
  "tabs": [
    {
      "_id": "...",
      "tabNumber": "BAR-123",
      "customerName": "John Doe",
      "tableNumber": "5",
      "status": "open",
      "subtotal": 450,
      "total": 450,
      "lineCount": 3,
      "reservationCount": 3,
      "hasExpiredReservations": false,
      "openedAt": "2026-09-11T14:00:00Z"
    }
  ],
  "count": 1
}
```

---

### Get Tab Details
**GET** `/api/bar/tabs-v3/{id}`

Get tab with all lines and reservation summary.

**Response:**
```json
{
  "tab": {
    "_id": "...",
    "tabNumber": "BAR-123",
    "customerName": "John Doe",
    "status": "open",
    "subtotal": 450,
    "total": 450
  },
  "lines": [
    {
      "_id": "...",
      "itemName": "Smirnoff 750ml",
      "servingName": "Tot",
      "quantity": 3,
      "unitPrice": 150,
      "lineTotal": 450,
      "addedAt": "2026-09-11T14:05:00Z"
    }
  ],
  "reservations": {
    "totalFraction": 0.15,
    "bottlesInvolved": 1,
    "earliestExpiry": "2026-09-11T14:35:00Z"
  }
}
```

---

### Add Line to Tab
**POST** `/api/bar/tabs-v3/{id}/add-line`

Add item to tab (creates reservation automatically).

**Body:**
```json
{
  "inventoryItemId": "...",
  "servingId": "...",
  "itemName": "Smirnoff 750ml",
  "servingName": "Tot",
  "quantity": 3,
  "unitPrice": 150,
  "discount": 0
}
```

**Success Response (201):**
```json
{
  "success": true,
  "line": {
    "_id": "...",
    "itemName": "Smirnoff 750ml",
    "servingName": "Tot",
    "quantity": 3,
    "lineTotal": 450
  },
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
```

**Error Response (400):**
```json
{
  "error": "Only 2 servings available",
  "errorCode": "insufficient_capacity",
  "available": 0.10,
  "availableServings": 2
}
```

---

### Remove Line from Tab
**DELETE** `/api/bar/tabs-v3/{id}/lines/{lineId}`

Remove item (releases reservation automatically).

**Response:**
```json
{
  "success": true,
  "updatedTab": {
    "subtotal": 300,
    "total": 300
  }
}
```

---

### Update Line Quantity
**PATCH** `/api/bar/tabs-v3/{id}/lines/{lineId}`

Change quantity (re-reserves with new amount).

**Body:**
```json
{
  "quantity": 5
}
```

**Success Response:**
```json
{
  "success": true,
  "updatedTab": {
    "subtotal": 750,
    "total": 750
  }
}
```

**Error Response (400):**
```json
{
  "error": "Only 4 servings available",
  "errorCode": "insufficient_capacity",
  "available": 0.20,
  "availableServings": 4
}
```

---

## Checkout

### Process Payment
**POST** `/api/bar/checkout-v3`

Finalize tab and commit reservations.

**Body:**
```json
{
  "tabId": "...",
  "paymentMethod": "cash",  // cash | card | mobile_money | credit
  "amountPaid": 450,
  "mpesaCode": "...",       // required if mobile_money
  "mpesaPhone": "...",      // required if mobile_money
  "customerId": "...",      // optional
  "customerName": "..."     // optional
}
```

**Success Response (200):**
```json
{
  "success": true,
  "saleId": "...",
  "orderNumber": "BAR-00042",
  "tabId": "...",
  "bottlesUsed": [
    {
      "bottleId": "...",
      "bottleNumber": 5,
      "newRemainingFraction": 0.35
    }
  ]
}
```

**Error Responses:**

**Reservations Expired (400):**
```json
{
  "error": "Some reservations have expired",
  "errorCode": "reservations_expired",
  "expiredCount": 2,
  "retryable": true,
  "message": "Tab was idle too long. Please review items and try again."
}
```

**Payment Failed (400):**
```json
{
  "error": "Card declined",
  "errorCode": "payment_failed",
  "retryable": true,
  "reservationsValid": true
}
```

**Credit Limit Exceeded (400):**
```json
{
  "error": "Credit limit exceeded. Available: KES 500, Required: KES 750"
}
```

**Commit Failed (500):**
```json
{
  "error": "Failed to deduct from bottles",
  "errorCode": "commit_failed",
  "retryable": false
}
```

---

## Error Code Reference

| Code | Meaning | Retryable | Action |
|------|---------|-----------|--------|
| `insufficient_capacity` | Not enough available | No | Show available, adjust quantity or open bottle |
| `no_bottles_open` | No open bottles | No | Open a bottle first |
| `invalid_quantity` | Quantity < 1 | No | Fix input validation |
| `bottle_not_found` | Product/serving missing | No | Check IDs |
| `reservations_expired` | Tab idle too long | Yes | Reconfirm items |
| `payment_failed` | Payment declined | Yes | Try different payment method |
| `commit_failed` | Server error during commit | Yes | Retry checkout |
| `server_error` | Unexpected error | Yes | Retry or contact support |

---

## Common Workflows

### Workflow 1: Quick Sale

```javascript
// 1. Create tab
const tabRes = await fetch('/api/bar/tabs-v3/create', {
  method: 'POST',
  body: JSON.stringify({
    customerName: 'Quick Sale',
    tableNumber: 'COUNTER'
  })
})
const { tab } = await tabRes.json()

// 2. Add items
await fetch(`/api/bar/tabs-v3/${tab._id}/add-line`, {
  method: 'POST',
  body: JSON.stringify({
    inventoryItemId: '...',
    servingId: '...',
    itemName: 'Smirnoff 750ml',
    servingName: 'Tot',
    quantity: 3,
    unitPrice: 150
  })
})

// 3. Checkout
const checkoutRes = await fetch('/api/bar/checkout-v3', {
  method: 'POST',
  body: JSON.stringify({
    tabId: tab._id,
    paymentMethod: 'cash',
    amountPaid: 450
  })
})
const { success, saleId } = await checkoutRes.json()
```

### Workflow 2: Handle Insufficient Capacity

```javascript
// Try to add item
const res = await fetch(`/api/bar/tabs-v3/${tabId}/add-line`, {
  method: 'POST',
  body: JSON.stringify({
    inventoryItemId: vodkaId,
    servingId: totId,
    quantity: 10,
    unitPrice: 150
  })
})

const data = await res.json()

if (!data.success && data.errorCode === 'insufficient_capacity') {
  // Show modal
  showModal({
    title: 'Not Enough Available',
    message: `Requested: 10 tots\nAvailable: ${data.availableServings} tots`,
    actions: [
      {
        label: `Add ${data.availableServings}`,
        onClick: () => addItem(vodkaId, totId, data.availableServings)
      },
      {
        label: 'Open Bottle',
        onClick: () => openBottle(vodkaId)
      },
      {
        label: 'Cancel'
      }
    ]
  })
}
```

### Workflow 3: Handle Payment Failure

```javascript
const checkoutRes = await fetch('/api/bar/checkout-v3', {
  method: 'POST',
  body: JSON.stringify({
    tabId,
    paymentMethod: 'card',
    amountPaid: 450
  })
})

const data = await checkoutRes.json()

if (!data.success) {
  if (data.errorCode === 'payment_failed' && data.retryable) {
    // Show retry modal
    showModal({
      title: 'Payment Failed',
      message: data.error + '\n\nYour items are still reserved for 30 minutes.',
      actions: [
        {
          label: 'Try Different Card',
          onClick: () => showPaymentForm()
        },
        {
          label: 'Pay Cash',
          onClick: () => retryCheckout('cash')
        },
        {
          label: 'Cancel'
        }
      ]
    })
  } else if (data.errorCode === 'reservations_expired') {
    // Reconfirm items
    showModal({
      message: 'Tab was idle too long. Reconfirming availability...',
      loading: true
    })
    await reconfirmTabItems(tabId)
    // Then allow retry
  }
}
```

---

## Rate Limits

No explicit rate limits, but recommendations:
- Availability checks: Max 1 per second per product
- Reservation extends: Max 1 per 30 seconds per tab
- Use debouncing for user input

---

## Testing

### Test Reservation Creation

```bash
curl -X POST http://localhost:3000/api/bar/reservations/create \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=..." \
  -d '{
    "tabId": "...",
    "inventoryItemId": "...",
    "servingId": "...",
    "quantity": 3,
    "unitPrice": 150
  }'
```

### Test Checkout

```bash
curl -X POST http://localhost:3000/api/bar/checkout-v3 \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=..." \
  -d '{
    "tabId": "...",
    "paymentMethod": "cash",
    "amountPaid": 450
  }'
```

---

## Background Jobs

### Setup Cron Jobs

```javascript
// In your scheduler (e.g., node-cron)
import cron from 'node-cron'
import { ReservationEngine } from '@/lib/bar/reservation-engine'

// Every 5 minutes: cleanup expired reservations
cron.schedule('*/5 * * * *', async () => {
  const conn = await getTenantConnection()
  const result = await ReservationEngine.cleanupExpiredReservations(conn)
  console.log(`Cleaned up ${result.releasedCount} expired reservations`)
  await conn.close()
})

// Every 1 minute: sync bottle capacities
cron.schedule('*/1 * * * *', async () => {
  const conn = await getTenantConnection()
  const result = await ReservationEngine.syncBottleReservedFractions(conn)
  if (result.discrepanciesFound > 0) {
    console.warn(`Fixed ${result.discrepanciesFound} bottle capacity discrepancies`)
  }
  await conn.close()
})
```

---

**API Version:** 3.0  
**Last Updated:** 2026-09-11  
**Base Implementation:** Complete ✅
