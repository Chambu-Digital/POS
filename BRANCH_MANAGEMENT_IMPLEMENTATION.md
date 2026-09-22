# Branch Management Implementation - Steps 1-5 Complete

## Overview
Multi-branch support with stock transfers between branches. Staff can be assigned to specific branches, and branch managers can manage their branch independently.

---

## ✅ Step 1: Schema Updates

### Staff Schema Updates (`lib/models/schemas.ts`)
- Added `branchId` field (nullable, ref: Branch)
- Added `isBranchManager` field (boolean, default: false)
- Added indexes for `branchId` and `isBranchManager`

### New Schemas Added

#### StockTransfer Schema
- **Fields:**
  - `userId`, `transferNumber` (unique, auto-generated: ST-YYYY-#####)
  - `fromBranchId`, `toBranchId` (Branch refs)
  - `items[]`: { module, moduleItemId, itemName, quantitySent, quantityReceived, unitPrice }
  - `status`: pending_receipt | received | rejected
  - `createdBy`, `createdByModel` (User/Staff)
  - `receivedBy`, `rejectedBy` (Staff refs)
  - `notes`, `rejectionReason`
  - `createdAt`, `receivedAt`, `rejectedAt`
- **Indexes:** userId, fromBranchId+status, toBranchId+status, transferNumber (unique)

#### Notification Schema
- **Fields:**
  - `userId`, `recipientId`, `recipientType` (user/staff)
  - `type`: transfer_received | transfer_rejected | info
  - `title`, `message`
  - `referenceId`, `referenceType` (stock_transfer, sale, other)
  - `isRead`, `createdAt`, `readAt`
- **Indexes:** userId+recipientId+isRead+createdAt, userId+recipientId+createdAt

### StockLedger Type Updates
- Added `TRANSFER_OUT` and `TRANSFER_IN` to enum types

### Model Factory Updates (`lib/tenant/get-models.ts`)
- Added `StockTransfer` and `Notification` models to factory

---

## ✅ Step 2: Auth & Context

### JWT Updates (`lib/jwt.ts`)
- `branchId` field already existed in TokenPayload
- Staff login now includes `branchId` from staff record

### Staff Login Updates (`app/api/auth/staff-login/route.ts`)
- Token creation now includes `branchId: foundStaff.branchId?.toString()`

### Branch Context Helper (`lib/branch-context.ts`)
- **`getBranchContext(request)`**: Returns current branch context
  - Staff: returns their assigned `branchId` from JWT
  - Owners: returns from `X-Branch-Context` header or `selected_branch` cookie
- **`setBranchCookie(branchId)`**: Sets branch selection cookie (30 days)
- **`clearBranchCookie()`**: Clears branch cookie

---

## ✅ Step 3: Staff API Updates

### POST `/api/staff` (`app/api/staff/route.ts`)
- Accepts `branchId` and `isBranchManager` fields
- Validates branch exists and belongs to owner
- Checks for existing branch manager before assigning
- Returns 409 if branch already has a manager

### PUT `/api/staff/[id]` (`app/api/staff/[id]/route.ts`)
- Handles `branchId` and `isBranchManager` updates
- Validates branch ownership
- Prevents duplicate branch managers
- Added fields to update list

---

## ✅ Step 4: Branch Selector for Owners

### POST `/api/auth/select-branch` (NEW)
- Owner-only endpoint to select branch context
- Validates branch ownership
- Sets `selected_branch` cookie
- Updates JWT token with new branchId
- Returns branch info

**Usage:**
```json
POST /api/auth/select-branch
{ "branchId": "507f1f77bcf86cd799439011" }
```

---

## ✅ Step 5: Stock Transfer API

### POST `/api/stock-transfers` (NEW)
- Creates inter-branch stock transfer
- **Requirements:**
  - Permission: `stock-transfers.create`
  - Source branch from context (current branch)
  - Destination `toBranchId` in request
  - Items array with module, moduleItemId, quantitySent
- **Process:**
  1. Validates branches exist and are different
  2. Generates unique transfer number (ST-YYYY-#####)
  3. Starts transaction
  4. For each item:
     - **Retail:** Deducts from Product.stock, creates TRANSFER_OUT ledger entry
     - **Pharmacy:** Deducts from Inventory, creates TRANSFER transaction
  5. Creates StockTransfer record with status pending_receipt
  6. Creates notifications for receiving branch staff
  7. Commits transaction or rolls back on error
- **Returns:** Transfer record

### GET `/api/stock-transfers` (NEW)
- Lists transfers with filters
- **Query params:**
  - `status`: pending_receipt | received | rejected
  - `direction`: sent | received
- **Access:**
  - Owners: see all transfers (filtered by selected branch if set)
  - Staff: see only transfers involving their assigned branch
- **Returns:** Array of transfers with populated branch and user refs

### PUT `/api/stock-transfers/[id]/receive` (NEW)
- Confirms receipt of transfer
- **Requirements:**
  - Permission: `stock-transfers.receive`
  - Must be receiving branch (toBranchId matches context)
  - Status must be pending_receipt
- **Body:** `{ items: [{ moduleItemId, quantityReceived }] }`
- **Process:**
  1. Validates transfer and branch context
  2. Starts transaction
  3. For each item:
     - **Retail:** Adds to Product.stock, creates TRANSFER_IN ledger entry
     - **Pharmacy:** Adds to Inventory (creates if not exists), creates TRANSFER transaction
     - Updates `quantityReceived` in transfer item
  4. Updates transfer status to received
  5. Sets receivedBy and receivedAt
  6. Creates notification for sender
  7. Commits or rolls back
- **Returns:** Updated transfer record

### PUT `/api/stock-transfers/[id]/reject` (NEW)
- Rejects transfer and restores stock
- **Requirements:**
  - Permission: `stock-transfers.receive`
  - Must be receiving branch
  - Status must be pending_receipt
- **Body:** `{ reason: "rejection reason" }`
- **Process:**
  1. Validates transfer and branch
  2. Starts transaction
  3. For each item:
     - **Retail:** Restores Product.stock, creates ADJUSTMENT ledger entry
     - **Pharmacy:** Restores Inventory, creates ADJUSTMENT transaction
  4. Updates transfer status to rejected
  5. Sets rejectedBy, rejectedAt, rejectionReason
  6. Creates rejection notification for sender
  7. Commits or rolls back
- **Returns:** Updated transfer record

### GET `/api/stock-transfers/pending-count` (NEW)
- Returns count of pending transfers for current branch
- Used for notification badge
- **Returns:** `{ count: number }`

---

## 📦 Notification API

### GET `/api/notifications` (NEW)
- Lists notifications for current user
- **Query params:**
  - `unreadOnly`: true/false
  - `limit`: number (default 50)
- **Returns:** `{ notifications: [], unreadCount: number }`

### PUT `/api/notifications` (NEW)
- Marks notifications as read
- **Body:**
  - `{ notificationId: "..." }` - mark single as read
  - `{ markAllRead: true }` - mark all as read
- **Returns:** Updated notification(s)

---

## 🔐 Permissions Added

### Core Module (`lib/modules.ts`)
- `core.stock-transfers.create` - Create inter-branch transfers
- `core.stock-transfers.receive` - Receive and confirm transfers

### Default Permissions
- **Staff/Cashier:** Both false by default
- **Manager:** Both true by default

---

## 📊 Data Flow

### Creating a Transfer (Branch A → Branch B)
1. User/Staff at Branch A creates transfer
2. Stock deducted from Branch A immediately
3. TRANSFER_OUT ledger entry created
4. Transfer record created with status: pending_receipt
5. Notification sent to Branch B staff

### Receiving a Transfer
1. Staff at Branch B views pending transfers
2. Reviews items and quantities
3. Confirms receipt (can adjust quantities received)
4. Stock added to Branch B
5. TRANSFER_IN ledger entry created
6. Transfer status updated to received
7. Notification sent to sender

### Rejecting a Transfer
1. Staff at Branch B views pending transfer
2. Provides rejection reason
3. Stock restored to Branch A
4. ADJUSTMENT ledger entry created
5. Transfer status updated to rejected
6. Notification sent to sender with reason

---

## 🔄 Next Steps (Steps 6-12)

### Step 6: Notification System UI
- Real-time polling (every 30s)
- Bell icon with badge in header
- Notification dropdown list

### Step 7: Stock Transfer UI
- `/dashboard/stock-transfers` page
- Create transfer modal
- Receive transfer modal
- Transfer history view

### Step 8: Module Integration
- Update existing inventory APIs to respect branch context
- Filter queries by branchId

### Step 9: Branch-Scoped Queries
- Middleware to inject branch context
- Update product/drug/inventory APIs

### Step 10: Permissions & Access
- Add stock-transfers link to sidebar
- Permission guards on UI

### Step 11: Settings UI
- Branch management interface
- Manager assignment UI

### Step 12: Migration & Defaults
- Script to assign existing staff to default branch
- Ensure default branch exists

---

## 🧪 Testing Checklist

- [ ] Create staff with branch assignment
- [ ] Update staff branch assignment
- [ ] Prevent duplicate branch managers
- [ ] Staff login includes branchId in JWT
- [ ] Owner can select branch via API
- [ ] Create retail product transfer
- [ ] Create pharmacy drug transfer
- [ ] Receive transfer with full quantities
- [ ] Receive transfer with partial quantities
- [ ] Reject transfer and verify stock restoration
- [ ] Verify ledger entries (TRANSFER_OUT, TRANSFER_IN, ADJUSTMENT)
- [ ] Notifications created for recipients
- [ ] Pending count updates correctly
- [ ] Staff can only see their branch transfers
- [ ] Owners can see all transfers

---

## 📝 API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/select-branch` | Owner selects branch context |
| GET | `/api/stock-transfers` | List transfers (with filters) |
| POST | `/api/stock-transfers` | Create new transfer |
| GET | `/api/stock-transfers/pending-count` | Count pending transfers |
| PUT | `/api/stock-transfers/[id]/receive` | Receive transfer |
| PUT | `/api/stock-transfers/[id]/reject` | Reject transfer |
| GET | `/api/notifications` | List notifications |
| PUT | `/api/notifications` | Mark notifications as read |

