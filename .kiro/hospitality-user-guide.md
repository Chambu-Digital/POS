# Hospitality Module - User Guide

## Quick Start

The Hospitality Module is a complete POS (Point of Sale) system designed for restaurants, bars, cafés, and food service businesses. This guide covers all features from basic operations to advanced workflows.

---

## Table of Contents
1. [Accessing the Module](#accessing-the-module)
2. [POS Interface Overview](#pos-interface-overview)
3. [Basic Operations](#basic-operations)
4. [Advanced Features](#advanced-features)
5. [Management Features](#management-features)
6. [Keyboard Shortcuts](#keyboard-shortcuts)
7. [Troubleshooting](#troubleshooting)

---

## Accessing the Module

### Prerequisites:
- User must have `hospitality.pos` permission
- Module must be enabled for your tenant
- At least one category and menu item must exist

### Navigation:
1. Login to the dashboard
2. Click **"Hospitality"** in the sidebar
3. Select **"POS"** from the Hospitality submenu

---

## POS Interface Overview

```
┌─────────────────────────────────────────────────────────────┐
│  MENU (Left Side)              │  CART (Right Side)         │
├────────────────────────────────┼────────────────────────────┤
│  🔍 Search                      │  🛒 Cart (0)               │
│  [All] [Drinks] [Food]...      │  Scanner Active 🔊         │
│                                 │                            │
│  ┌──────┐ ┌──────┐ ┌──────┐   │  👤 Add Customer           │
│  │Coffee│ │ Tea  │ │Juice │   │  [Manual Barcode Entry]    │
│  │$5.00 │ │$3.00 │ │$4.00 │   │                            │
│  └──────┘ └──────┘ └──────┘   │  (Cart Items Here)         │
│                                 │                            │
│  ┌──────┐ ┌──────┐ ┌──────┐   │  Subtotal: $0.00           │
│  │Burger│ │Pizza │ │Salad │   │  Discount: $0.00           │
│  │$12.00│ │$15.00│ │$8.00 │   │  Total: $0.00              │
│  └──────┘ └──────┘ └──────┘   │                            │
│                                 │  [Complete Sale - F12]     │
└─────────────────────────────────────────────────────────────┘
```

---

## Basic Operations

### 1. Creating a Sale

#### Step-by-Step:
1. **Select Items from Menu**
   - Click on menu item card
   - For servable items (e.g., beer), select serving size
   - Choose quantity
   - Click "Add to Cart"

2. **Review Cart**
   - Items appear on right side
   - Adjust quantities with +/- buttons
   - Remove items with X button

3. **Add Customer (Optional)**
   - Click "Add Customer" button (or press F11)
   - Search by name or phone
   - Select customer from results
   - Customer info appears in cart

4. **Apply Discount (Optional)**
   - Enter discount amount in cart summary
   - Discount applies to entire order

5. **Complete Sale**
   - Click "Complete Sale" button (or press F12)
   - Select payment method (Cash, M-Pesa, Card, Credit)
   - Choose order type (Dine In, Takeaway, Delivery)
   - For Dine In: Enter table number (optional)
   - Click "Complete Sale"

6. **Receipt**
   - Receipt displays automatically
   - Print using browser print dialog
   - Close receipt to return to POS

---

### 2. Menu Item Types

#### Servable Items (e.g., Beer, Soda)
- **Indicator:** Shows "X options" instead of price
- **Behavior:** Opens serving selection modal
- **Example:** Beer → Select "Pint", "Half Pint", or "Bottle"
- **Stock:** Tracks servings per serving type

#### Whole Items (e.g., Burger, Pizza)
- **Indicator:** Shows price directly
- **Behavior:** Adds directly to cart
- **Example:** Burger $12.00 → Added as 1 unit
- **Stock:** Tracks whole units

#### Made-to-Order (MTO) Items
- **Indicator:** "MTO" badge on card
- **Behavior:** No stock tracking
- **Example:** Custom sandwich
- **Stock:** Always available

---

### 3. Stock Indicators

| Indicator | Meaning | Action |
|-----------|---------|--------|
| **Green** (normal) | Adequate stock | Add to cart normally |
| **Orange** (⬇️ icon) | Low stock (<10) | Warning, still available |
| **Red** ("Out") | Out of stock | Cannot add to cart |
| **"MTO"** badge | Made to order | Always available |

---

## Advanced Features

### 1. Barcode Scanner

#### Hardware Scanner (Recommended):
- Connect USB/Bluetooth barcode scanner
- Scanner Active badge shows when enabled
- Scan any menu item barcode
- Item automatically adds to cart

#### Manual Entry:
- Use "Manual Barcode Entry" field in cart
- Type or paste barcode
- Press Enter or click submit
- Item adds to cart if found

#### Tips:
- Scanner pauses while editing cart (prevents accidental scans)
- Green feedback shows successful scan
- Red feedback shows errors
- Yellow shows "detecting" state

---

### 2. Held Orders

#### Holding an Order:
1. Add items to cart
2. Click "Hold" button (or press F9)
3. Optionally enter table name/number
4. Order saves to localStorage
5. Cart clears for next order

#### Recalling a Held Order:
1. Click "Held (X)" in header (or press F10)
2. Select order to recall
3. Order populates cart
4. Continue or modify as needed

#### Use Cases:
- Customer walks away before paying
- Take orders for multiple tables
- Kitchen preparing previous order
- Split orders across registers

---

### 3. Customer Integration

#### Benefits:
- Track customer purchase history
- Build loyalty programs
- Contact customers
- Personalize service

#### Workflow:
1. Press F11 or click "Add Customer"
2. Search by name or phone (min 2 chars)
3. Select customer from list
4. Customer info shows in cart
5. Remove by clicking X on customer card

#### Customer Data Saved:
- Customer ID linked to sale
- Purchase history updated
- Loyalty points (if configured)
- Contact for receipts/promotions

---

### 4. Receipt System

#### What's Included:
- Business header
- Date/time and Order ID
- Customer information (if added)
- Itemized list with servings
- Subtotal, discount, total
- Payment method and table number
- Thank you message

#### Printing:
- Click "Print" button in receipt modal
- Uses browser print dialog
- Select connected printer
- Configure page size (usually 80mm for receipt printers)
- Print or Save as PDF

---

## Management Features

### 1. Menu Management
**Location:** Hospitality → Menu

#### Menu Items Tab:
- View all menu items
- Create new items (For Sale or Ingredients)
- Set serving types for servable items
- Configure pricing
- Upload item images
- Set inventory tracking mode

#### Categories Tab:
- Create/edit categories
- Set category colors
- Configure visibility
- Reorder categories

---

### 2. Inventory Management
**Location:** Hospitality → Inventory

#### For Sale Tab:
- View current stock levels
- See available servings
- Monitor inventory value
- Check low stock alerts

#### Ingredients Tab:
- Manage ingredient stock
- Track consumption
- Monitor expiration dates
- Receive new stock

#### Receive Stock Tab:
- Record new deliveries
- Enter batch details
- Update stock levels
- Generate FIFO batches

---

### 3. Stock Operations
**Location:** Hospitality → Stock

#### Features:
- Movement history
- Waste logging
- Stock adjustments
- Stock consolidation
- Batch management

---

### 4. Production Tracking
**Location:** Hospitality → Production

#### Features:
- Log production runs
- Track yield variance
- Approval workflow (>20% variance)
- Production history
- Cost analysis

---

### 5. Reports
**Location:** Hospitality → Reports

#### Available Reports:
- **Sales Analytics:** Revenue trends by period
- **Top Items:** Best-selling items
- **Payment Breakdown:** Payment method distribution
- **Export:** Download data as CSV

#### Date Filters:
- Today
- Yesterday
- Last 7 days
- Last 30 days
- Custom range

---

### 6. Order History
**Location:** Hospitality → Orders

#### Features:
- View all completed orders
- Filter by date, status, payment
- Search by order ID
- View order details
- Check customer information
- Review payment status

---

## Keyboard Shortcuts

### POS Shortcuts:
| Shortcut | Action | Requirements |
|----------|--------|--------------|
| **F9** | Hold Order | Cart has items |
| **F10** | View Held Orders | Held orders exist |
| **F11** | Select Customer | Anytime |
| **F12** | Checkout | Cart has items |
| **ESC** | Close Modal | Modal is open |

### Tips:
- Shortcuts work when NOT typing in input fields
- Hover over buttons to see shortcut hints
- Keyboard icon in header shows all shortcuts

---

## Troubleshooting

### Common Issues:

#### "Failed to load menu"
**Cause:** Network error or API issue  
**Solution:**
1. Check internet connection
2. Refresh the page (F5)
3. Check browser console for errors
4. Contact admin if persists

---

#### "Out of stock" when item should be available
**Cause:** Stock not updated or inventory mode incorrect  
**Solution:**
1. Go to Inventory → For Sale
2. Check actual stock levels
3. Receive new stock if needed
4. Verify inventory mode (tracked vs untracked)

---

#### Barcode scanner not working
**Cause:** Scanner not configured or driver issue  
**Solution:**
1. Check scanner connection (USB/Bluetooth)
2. Test scanner in notepad (should type barcode)
3. Verify "Scanner Active" badge shows
4. Try manual barcode entry
5. Check scanner configuration (should act as keyboard)

---

#### Customer search returns no results
**Cause:** Customer not in database or spelling error  
**Solution:**
1. Type minimum 2 characters
2. Try searching by phone number
3. Verify customer exists in Customers module
4. Create new customer if needed

---

#### Payment processing fails
**Cause:** Validation error or network issue  
**Solution:**
1. Check error message (shown in toast)
2. Verify cart is not empty
3. Ensure payment method selected
4. Check stock availability
5. Try again or contact support

---

#### Receipt won't print
**Cause:** Printer not connected or browser settings  
**Solution:**
1. Check printer connection
2. In print dialog, select correct printer
3. Configure page size (80mm for receipt printers)
4. Try "Save as PDF" first to verify receipt
5. Check printer drivers

---

### Performance Issues:

#### Slow menu loading
- Check internet speed
- Clear browser cache
- Reduce menu item count (archive old items)
- Contact admin to optimize images

#### Scanner lag or missed scans
- Check scanner quality
- Ensure good barcode print quality
- Scan slowly and steadily
- Try manual entry for difficult barcodes

---

## Best Practices

### For Cashiers:
1. **Keep Cart Clean:** Clear cart after each sale
2. **Use Hold Feature:** For interrupted transactions
3. **Verify Stock:** Check indicators before promising items
4. **Add Customers:** When possible for loyalty
5. **Use Shortcuts:** Master F9-F12 for speed

### For Managers:
1. **Monitor Stock:** Check inventory daily
2. **Review Reports:** Analyze sales trends weekly
3. **Train Staff:** On keyboard shortcuts and features
4. **Update Menu:** Keep items and prices current
5. **Test Equipment:** Regular scanner/printer checks

### For Kitchen Staff:
1. **Check Orders:** View order history for details
2. **Track Production:** Log all production runs
3. **Report Waste:** Use waste logging for spoilage
4. **Monitor MTO:** Made-to-order items have no stock limits

---

## Tips for Efficiency

### Speed Tips:
- Use keyboard shortcuts (F9-F12)
- Master category filters for quick navigation
- Use search for specific items
- Keep frequently ordered items in default category
- Pre-select common payment methods

### Accuracy Tips:
- Always verify quantities before completing sale
- Double-check serving sizes for servable items
- Add customers for receipt purposes
- Review cart before payment
- Print receipts for record-keeping

### Organization Tips:
- Use held orders for busy times
- Clear held orders at end of shift
- Keep customer database updated
- Archive completed orders regularly
- Review stock levels during slow periods

---

## Mobile Usage

### Mobile POS Interface:
- **Bottom Tab Bar:** Switch between Menu and Cart
- **Badge Counter:** Shows items in cart
- **Touch-Friendly:** Large buttons and cards
- **Swipe Modals:** Easy to dismiss
- **Responsive:** Works on phones and tablets

### Mobile Tips:
- Use portrait mode for POS
- Landscape for larger menu view
- Tap and hold for additional options
- Pinch to zoom on menu items
- Use hardware back button as ESC

---

## Support

### Need Help?
- **Documentation:** Check this guide first
- **Admin Panel:** Contact your system administrator
- **Technical Issues:** Check browser console
- **Training:** Request demo from manager

### Reporting Issues:
1. Note exact error message
2. Screenshot the problem
3. Record steps to reproduce
4. Check if issue persists after refresh
5. Contact support with details

---

## Feature Highlights Summary

✅ **Full POS System** - Complete order management  
✅ **Barcode Scanner** - Hardware and manual entry  
✅ **Customer Integration** - Search and link customers  
✅ **Receipt Printing** - Professional receipts  
✅ **Held Orders** - Multi-order management  
✅ **Stock Tracking** - Real-time inventory  
✅ **Serving Types** - Flexible portion control  
✅ **Made-to-Order** - Untracked items  
✅ **Keyboard Shortcuts** - Fast operations  
✅ **Mobile Responsive** - Works on any device  
✅ **Multiple Payment Methods** - Cash, Card, M-Pesa, Credit  
✅ **Order Types** - Dine-in, Takeaway, Delivery  
✅ **Comprehensive Reports** - Sales analytics  
✅ **Production Tracking** - Yield management  
✅ **Stock Operations** - Waste, adjustments, consolidation  

---

**Version:** 1.0 (Phases 1-9 Complete)  
**Last Updated:** Phase 8 & 9 Implementation  
**Status:** Production Ready
