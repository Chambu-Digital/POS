// ─── Raw schemas — imported by the model factory ──────────────────────────────
// These are schema definitions only, NOT bound to any connection.
// The factory in lib/tenant/get-models.ts binds them per-tenant connection.

import mongoose from 'mongoose'
import bcryptjs from 'bcryptjs'


// ── Product ───────────────────────────────────────────────────────────────────
// Product catalog - defines the product but stock is tracked per-branch
export const productSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supplierId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    category:     { type: String, required: true },
    productName:  { type: String, required: true },
    variant:      String,
    brand:        String,
    model:        String,
    unit:         String,
    buyingPrice:  { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    wholeSale:    { type: Number, default: 0 },
    description:  String,
    barcode:      { type: String, default: '' },
    images:       { type: [String], default: [] },
    stock:        { type: Number, required: true, default: 0 },  // DEPRECATED: Use ProductInventory instead
    lowStockThreshold: { type: Number, default: 10 },
    restocking: {
      customLeadTime:      { type: Number },  // Override default lead time (days)
      safetyBuffer:        { type: Number },  // Override default safety buffer (days)
      reorderPoint:        { type: Number },  // Manual reorder point override
      preferredSupplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }
    },
    // ── Per-unit / lot tracking ───────────────────────────────────────────────
    // When trackLots is true, stock is managed through individual ProductBatch
    // documents rather than a single integer counter.  lotUnit describes what
    // each measurable unit is called (metres, pieces, kg, litres, rolls …).
    trackLots: { type: Boolean, default: false },
    lotUnit:   { type: String, default: 'pieces' },  // display label for the quantity unit
    createdAt:    { type: Date, default: Date.now },
    updatedAt:    { type: Date, default: Date.now },
  },
  { collection: 'products' }
)
productSchema.index({ userId: 1, productName: 1 })
productSchema.index({ userId: 1, category: 1 })
productSchema.index({ userId: 1, barcode: 1 })

// ── ProductInventory ───────────────────────────────────────────────────────────
// Branch-specific inventory for retail products (similar to pharmacy Inventory)
export const productInventorySchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    stock:        { type: Number, required: true, default: 0 },
    reserved:     { type: Number, default: 0 },  // For held orders
    lastUpdated:  { type: Date, default: Date.now },
    createdAt:    { type: Date, default: Date.now },
  },
  { collection: 'product_inventory' }
)
productInventorySchema.index({ userId: 1, branchId: 1, productId: 1 }, { unique: true })
productInventorySchema.index({ userId: 1, branchId: 1 })
productInventorySchema.index({ userId: 1, productId: 1 })

// ── Sale ──────────────────────────────────────────────────────────────────────
export const saleSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // Branch where sale was made
    staffId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    orderNumber:   { type: String, index: true },
    customerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName:  { type: String, default: '' },
    items: [{
      productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
      productName: { type: String, required: true },
      brand:       { type: String, default: '' },
      model:       { type: String, default: '' },
      variant:     { type: String, default: '' },
      quantity:    { type: Number, required: true },
      price:       { type: Number, required: true },
      discount:    { type: Number, default: 0 },
      // Lot tracking — populated when item was sold from a specific ProductBatch
      batchId:     { type: mongoose.Schema.Types.ObjectId, ref: 'ProductBatch' },
      lotLabel:    { type: String, default: '' },
    }],
    subtotal:      Number,
    discount:      { type: Number, default: 0 },
    total:         { type: Number, required: true },
    
    // Multiple payments support
    payments: [{
      method:            { type: String, enum: ['cash', 'card', 'mobile_money', 'bank', 'credit', 'custom', 'deposit'], required: true },
      amount:            { type: Number, required: true },
      bankProviderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'BankProvider' },
      bankProviderName:  { type: String, default: '' },
      customMethodId:    { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod' },
      customMethodName:  { type: String, default: '' },
      mpesaCode:         { type: String, default: '' },
      mpesaPhone:        { type: String, default: '' },
      mpesaType:         { type: String, enum: ['stk_push', 'manual'], default: 'manual' },
      timestamp:         { type: Date, default: Date.now },
      // ── Customer deposit consumption ────────────────────────────────────────
      // Populated when method = 'deposit' (a pickup drawing down a customer
      // prepayment). This is an internal transfer, NOT a real cash inflow —
      // the report's per-method rollup must exclude it from cash totals.
      depositId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Deposit' },
    }],
    
    // Legacy fields (kept for backward compatibility)
    amountPaid:    { type: Number, default: 0 },
    paymentMethod: { type: String, required: false }, // Removed enum to support custom payment methods
    mpesaCode:     String,
    mpesaPhone:    String,
    creditApplied: { type: Number, default: 0 },
    
    // Cost of goods sold — sum of (quantity × buyingPrice) for each line item.
    // Recorded at sale time so profit can be computed without re-querying products.
    costOfGoodsSold: { type: Number, default: 0 },
    
    // Debt tracking
    debt:          { type: Number, default: 0 },  // total - sum(payments.amount)
    paymentStatus: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'paid' },
    
    notes:         String,
    source:        { type: String, enum: ['pos', 'rental'], default: 'pos' },
    rentalMeta: {
      bookingId:       { type: mongoose.Schema.Types.ObjectId },
      serviceName:     String,
      serviceCategory: String,
      pricingLabel:    String,
      startTime:       Date,
      endTime:         Date,
      guestCount:      Number,
      deposit:         Number,
      customerName:    String,
      customerPhone:   String,
      customerIdNo:    String,
    },
    // Return tracking
    returns: [{
      productId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      productName:   { type: String, required: true },
      quantity:      { type: Number, required: true },
      price:         { type: Number, required: true },
      condition:     { type: String, enum: ['resellable', 'damaged'], required: true },
      reason:        { type: String, required: true },
      notes:         String,
      returnedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
      returnedAt:    { type: Date, default: Date.now },
      // Lot tracking — carried from the original sale line item
      batchId:       { type: mongoose.Schema.Types.ObjectId, ref: 'ProductBatch' },
      lotLabel:      { type: String, default: '' },
      
      // Approval workflow
      status:        { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedAt:    Date,
      
      // Refund payment tracking
      refundAmount:      { type: Number, default: 0 },
      refundMethod:      { type: String, default: '' }, // cash, mobile_money, bank, custom, etc.
      bankProviderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'BankProvider' },
      bankProviderName:  { type: String, default: '' },
      customMethodId:    { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod' },
      customMethodName:  { type: String, default: '' },
      mpesaCode:         { type: String, default: '' },
      mpesaPhone:        { type: String, default: '' },
    }],
    totalReturned:        { type: Number, default: 0 },
    isPartiallyReturned:  { type: Boolean, default: false },
    isFullyReturned:      { type: Boolean, default: false },
    
    // Exchange tracking (customer returns item + gets new one)
    exchanges: [{
      // ── Legacy singular fields (kept for backward compat with old records) ──
      returnedProductId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      returnedProductName: { type: String },
      quantityReturned:    { type: Number },
      returnedPrice:       { type: Number },
      newProductId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      newProductName:      { type: String },
      quantityReceived:    { type: Number },
      newPrice:            { type: Number },

      // ── Multi-item arrays (new exchanges use these) ───────────────────────
      // returnedItems: items the customer brings back from the original sale
      returnedItems: [{
        productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        productName: { type: String, required: true },
        quantity:    { type: Number, required: true },
        price:       { type: Number, required: true },  // original sale price per unit
      }],
      // newItems: items the shop hands out in exchange
      newItems: [{
        productId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        productName:   { type: String, required: true },
        quantity:      { type: Number, required: true },
        price:         { type: Number, required: true },   // catalog selling price
        overridePrice: { type: Number, default: null },    // cashier-set price (replaces catalog price when present)
        discount:      { type: Number, default: 0 },       // per-item discount in KSh
        effectivePrice:{ type: Number, required: true },   // resolved price used for priceDifference: (overridePrice ?? price) - discount
      }],
      
      priceDifference:     { type: Number, required: true },  // positive = customer pays extra, negative = customer receives credit
      reason:              { type: String, default: '' },
      notes:               String,
      processedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
      processedAt:         { type: Date, default: Date.now },
      
      // Approval workflow
      status:              { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      approvedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedAt:          Date,
      
      // Dynamic payment tracking (for price difference)
      paymentMethod:       { type: String, default: '' }, // cash, mobile_money, bank, custom, credit, etc.
      bankProviderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'BankProvider' },
      bankProviderName:    { type: String, default: '' },
      customMethodId:      { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod' },
      customMethodName:    { type: String, default: '' },
      mpesaCode:           { type: String, default: '' },
      mpesaPhone:          { type: String, default: '' },
    }],
    totalExchanged:       { type: Number, default: 0 },  // sum of price differences for all exchanges
    
    status:    { type: String, enum: ['completed', 'pending', 'held', 'refunded', 'partially_refunded', 'exchanged', 'voided'], default: 'completed' },
    synced:    { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },

    // ── Soft delete (void) ────────────────────────────────────────────────────
    // voidedAt is the canonical "is this order deleted?" check.
    // null = active order; Date = voided. Never hard-deleted.
    voidedAt:   { type: Date,   default: null },
    voidedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },  // null = owner voided it
    voidReason: { type: String, default: '' },
  },
  { collection: 'sales' }
)
saleSchema.index({ userId: 1, createdAt: -1 })
saleSchema.index({ userId: 1, branchId: 1, createdAt: -1 })
saleSchema.index({ userId: 1, orderNumber: 1 })

// ── Customer ──────────────────────────────────────────────────────────────────
export const customerSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:          { type: String, required: true, trim: true },
    phone:         { type: String, default: '', trim: true },
    email:         { type: String, default: '' },
    idNumber:      { type: String, default: '', trim: true }, // ID number required for credit
    creditBalance: { type: Number, default: 0 }, // positive = owes us, negative = we owe them
    creditLimit:   { type: Number, default: 0 }, // maximum credit allowed (0 = no credit)
    depositBalance: { type: Number, default: 0 }, // prepayment we owe the customer (always >= 0).
                                                  // Tracked SEPARATELY from creditBalance so debt
                                                  // and prepayment never net — every cent stays
                                                  // attributable to its payment method in reports.
    ledger: [{
      date:             { type: Date, default: Date.now },
      type:             { type: String, enum: ['purchase', 'payment', 'adjustment', 'deposit', 'deposit_use', 'deposit_refund', 'deposit_return'] },
      amount:           Number,   // positive = debt added, negative = debt reduced
                          // For 'deposit':           positive = prepayment received (we owe them)
                          // For 'deposit_use':       negative = prepayment consumed at pickup (no cash)
                          // For 'deposit_refund':    negative = prepayment returned to customer (cash outflow)
                          // For 'deposit_return':    positive = prepayment credited back when deposit-funded
                          //                          goods are returned (no cash; reverses a deposit_use)
      balance:          Number,   // running balance after this entry
      saleId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
      note:             String,
      // Payment method tracking (for 'payment' type entries)
      paymentMethod:    { type: String, enum: ['cash', 'card', 'mobile_money', 'bank', 'custom'], default: undefined },
      mpesaCode:        { type: String, default: '' },
      mpesaPhone:       { type: String, default: '' },
      bankProviderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'BankProvider' },
      bankProviderName: { type: String, default: '' },
      customMethodId:   { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod' },
      customMethodName: { type: String, default: '' },
      // ── Customer deposit audit fields ────────────────────────────────────────
      // Populated for type = 'deposit' | 'deposit_use' | 'deposit_refund'.
      depositId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Deposit' },
      // For 'deposit_refund' only: when refund is paid out via a method different
      // from the original deposit method, this captures the override for audit.
      // Empty string = refunded to original method (no override).
      refundMethodOverride: { type: String, default: '' },
      approvedBy:         { type: mongoose.Schema.Types.ObjectId },   // User/Staff who approved override/refund
      // ── Cashier attribution (deposit + payment entries) ──────────────────────
      // Who collected/processed this entry, for per-staff accountability in
      // the end-of-day report. Used by 'payment' (credit settlement), 'deposit',
      // 'deposit_use', and 'deposit_refund' ledger types.
      collectedBy:      { type: mongoose.Schema.Types.ObjectId },
      collectedByType:  { type: String, enum: ['user', 'staff'], default: undefined },
    }],
    createdAt:     { type: Date, default: Date.now },
  },
  { collection: 'customers' }
)
customerSchema.index({ userId: 1, name: 1 })
customerSchema.index({ userId: 1, phone: 1 })
customerSchema.index({ userId: 1, depositBalance: 1 })  // "customers with active prepayments" lookup

// ── Category ──────────────────────────────────────────────────────────────────
export const categorySchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:         { type: String, required: true, trim: true },
    description:  { type: String, default: '' },
    productCount: { type: Number, default: 0 },
    color:        { type: String, default: '#3b82f6' },
    icon:         { type: String, default: 'package' },
    isActive:     { type: Boolean, default: true },
    createdAt:    { type: Date, default: Date.now },
    updatedAt:    { type: Date, default: Date.now },
  },
  { collection: 'categories' }
)
categorySchema.index({ userId: 1, name: 1 }, { unique: true })
categorySchema.index({ userId: 1, isActive: 1 })
categorySchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── Staff ─────────────────────────────────────────────────────────────────────
export const staffSchema = new mongoose.Schema(
  {
    userId:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // Primary branch assignment
    managerOfBranches:   { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }], default: [] }, // Array of branches they manage
    name:                { type: String, required: true },
    email:               { type: String, required: true, lowercase: true, trim: true },
    phone:               { type: String, default: '' },
    jobDescription:      { type: String, default: '' },
    firstName:           { type: String, default: '' },
    middleName:          { type: String, default: '' },
    lastName:            { type: String, default: '' },
    nationalId:          { type: String, default: '' },
    kraPin:              { type: String, default: '' },
    nhifNo:              { type: String, default: '' },
    nssfNo:              { type: String, default: '' },
    leaveDays:           { type: Number, default: 14 },
    salary:              { type: Number, default: 0 },
    commissionStructure: { type: String, default: '' },
    employmentType:      { type: String, enum: ['full-time', 'part-time', 'contract', 'intern', ''], default: '' },
    password:            { type: String, required: true, select: false },
    role:                { type: String, enum: ['cashier', 'manager', 'supervisor', 'employee'], required: true },
    permissions: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        'pos.sales': true,
        'pos.orders': true,
        'pos.inventory': true,
        'pos.reports': false,
        'pos.expenses': false,
        'rentals.bookings': false,
        'rentals.manage': false,
      }),
    },
    // Temp seller fields for mobile shops
    isTemporary:      { type: Boolean, default: false },  // True for day workers
    lastDeployedDate: { type: Date },  // Last time deployed to mobile shop
    deploymentCount:  { type: Number, default: 0 },  // Total deployments
    mobileShopId:     { type: mongoose.Schema.Types.ObjectId, ref: 'MobileShop' },  // Current active mobile shop
    active:    { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'staff' }
)
staffSchema.index({ userId: 1, email: 1 })
staffSchema.index({ userId: 1, branchId: 1 })
staffSchema.index({ userId: 1, managerOfBranches: 1 })
staffSchema.index({ userId: 1, isTemporary: 1 })
staffSchema.index({ userId: 1, mobileShopId: 1 })
staffSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const salt = await bcryptjs.genSalt(10)
  this.password = await bcryptjs.hash(this.password as string, salt)
  next()
})
staffSchema.methods.comparePassword = async function (password: string) {
  return bcryptjs.compare(password, this.password)
}

// ── User ──────────────────────────────────────────────────────────────────────
export const userSchema = new mongoose.Schema(
  {
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:   { type: String, required: true, select: false },
    shopName:   { type: String, required: true },
    role:       { type: String, enum: ['admin'], default: 'admin' },
    firstName:  { type: String, default: '' },
    middleName: { type: String, default: '' },
    lastName:   { type: String, default: '' },
    phone:      { type: String, default: '' },
    nationalId: { type: String, default: '' },
    kraPin:     { type: String, default: '' },
    position:   { type: String, default: 'OWNER' },
    settings:   { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt:  { type: Date, default: Date.now },
    lastLogin:  Date,
  },
  { collection: 'users' }
)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const salt = await bcryptjs.genSalt(10)
  this.password = await bcryptjs.hash(this.password as string, salt)
  next()
})
userSchema.methods.comparePassword = async function (password: string) {
  return bcryptjs.compare(password, this.password)
}

// ── Rental ────────────────────────────────────────────────────────────────────
export const rentalSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    customer: {
      name:  { type: String, required: true },
      phone: { type: String, required: true },
      idNo:  String,
    },
    items: [{
      productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      productName: { type: String, required: true },
      quantity:    { type: Number, required: true },
      rentalRate:  { type: Number, required: true },
      rateType:    { type: String, enum: ['per_minute', 'hourly', 'daily', 'weekly'], required: true },
    }],
    startTime:            { type: Date, required: true },
    endTime:              Date,
    duration:             Number,
    deposit:              { type: Number, default: 0 },
    depositPaymentMethod: String,
    totalAmount:          Number,
    paymentMethod:        { type: String, enum: ['cash', 'card', 'mobile_money'] },
    mpesaCode:            String,
    mpesaPhone:           String,
    status:               { type: String, enum: ['active', 'returned', 'overdue'], default: 'active' },
    notes:                String,
  },
  { collection: 'rentals', timestamps: true }
)
rentalSchema.index({ userId: 1, createdAt: -1 })
rentalSchema.index({ userId: 1, status: 1 })

// ── RentalService ─────────────────────────────────────────────────────────────
export const rentalServiceSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:        { type: String, required: true },
    category:    { type: String, enum: ['room', 'bike', 'car', 'airbnb', 'other'], required: true },
    description: String,
    pricing: [{
      label:    { type: String, required: true },
      duration: { type: Number, required: true },
      price:    { type: Number, required: true },
    }],
    amenities: [String],
    capacity:  Number,
    isActive:  { type: Boolean, default: true },
    imageUrl:  String,
  },
  { collection: 'rental_services', timestamps: true }
)
rentalServiceSchema.index({ userId: 1, category: 1 })

// ── RentalBooking ─────────────────────────────────────────────────────────────
export const rentalBookingSchema = new mongoose.Schema(
  {
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    staffId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    serviceId:       { type: mongoose.Schema.Types.ObjectId, ref: 'RentalService', required: true },
    serviceName:     { type: String, required: true },
    serviceCategory: { type: String, required: true },
    pricingLabel:    { type: String, required: true },
    pricingDuration: { type: Number, required: true },
    pricingRate:     { type: Number, required: true },
    startTime:       { type: Date, required: true },
    endTime:         Date,
    customer: {
      name:  { type: String, required: true },
      phone: { type: String, required: true },
      idNo:  String,
    },
    guestCount:           { type: Number, default: 1 },
    notes:                String,
    deposit:              { type: Number, default: 0 },
    depositPaymentMethod: String,
    totalAmount:          Number,
    paymentMethod:        { type: String, enum: ['cash', 'card', 'mobile_money'] },
    mpesaCode:            String,
    mpesaPhone:           String,
    status:               { type: String, enum: ['active', 'completed', 'cancelled', 'overdue'], default: 'active' },
  },
  { collection: 'rental_bookings', timestamps: true }
)
rentalBookingSchema.index({ userId: 1, createdAt: -1 })
rentalBookingSchema.index({ userId: 1, status: 1 })

// ── KitchenOrder ──────────────────────────────────────────────────────────────
const kitchenOrderItemSchema = new mongoose.Schema(
  {
    id:       { type: String, required: true },
    menuItemId: String,
    name:     { type: String, required: true },
    quantity: { type: Number, required: true },
    notes:    String,
    category: { type: String, required: true },
    station:  String,
    prepTime: { type: Number, default: 15 },
  },
  { _id: false }
)

export const kitchenOrderSchema = new mongoose.Schema(
  {
    userId:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderNumber:         { type: String, required: true },
    tableNumber:         { type: String, required: true },
    tableSection:        String,
    waiterName:          { type: String, required: true },
    waiterId:            String,
    coverCount:          { type: Number, default: 1 },
    items:               { type: [kitchenOrderItemSchema], required: true },
    status:              { type: String, enum: ['pending', 'preparing', 'ready', 'served'], default: 'pending' },
    priority:            { type: String, enum: ['normal', 'rush', 'vip'], default: 'normal' },
    orderType:           { type: String, enum: ['dine-in', 'takeaway', 'delivery'], default: 'dine-in' },
    specialInstructions: String,
    preparingAt:         Date,
    readyAt:             Date,
    servedAt:            Date,
    totalAmount:         { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'kitchen_orders' }
)
kitchenOrderSchema.index({ userId: 1, createdAt: -1 })
kitchenOrderSchema.index({ userId: 1, status: 1 })
kitchenOrderSchema.index({ userId: 1, tableNumber: 1, status: 1 })

// ── MenuItem ──────────────────────────────────────────────────────────────────
export const menuItemSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:        { type: String, required: true },
    description: { type: String, default: '' },
    category:    { type: String, required: true, enum: ['starter', 'main', 'side', 'dessert', 'drink'], default: 'main' },
    price:       { type: Number, required: true, min: 0 },
    prepTime:    { type: Number, default: 15 },
    station:     { type: String, enum: ['grill', 'drinks', 'dessert', 'pizza', 'all'], default: 'all' },
    available:   { type: Boolean, default: true },
    popular:     { type: Boolean, default: false },
    image:       { type: String, default: '' },
    productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    ingredients: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity:  { type: Number, default: 1 },
      unit:      { type: String, default: 'unit' }
    }],
    allergens:    [{ type: String }],
    spicyLevel:   { type: Number, min: 0, max: 5, default: 0 },
    vegetarian:   { type: Boolean, default: false },
    vegan:        { type: Boolean, default: false },
    glutenFree:   { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'menu_items' }
)
menuItemSchema.index({ userId: 1, category: 1 })
menuItemSchema.index({ userId: 1, available: 1 })

// ── Expense ───────────────────────────────────────────────────────────────────
export const expenseCategorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:   { type: String, required: true, trim: true },
  },
  { collection: 'expense_categories' }
)
expenseCategorySchema.index({ userId: 1, name: 1 }, { unique: true })

export const expenseSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // Branch where expense occurred
    staffId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },  // Who logged the expense
    paidBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },  // Who paid the expense (null = owner)
    title:         { type: String, required: true, trim: true },
    category:      { type: String, default: '' }, // Optional category
    notes:         { type: String, default: '' },
    amount:        { type: Number, required: true },
    date:          { type: Date, default: Date.now },  // When expense was incurred
    paymentMethod: { type: String, enum: ['cash', 'card', 'mobile_money', 'bank', 'custom', ''], default: '' }, // How it was paid
    paymentDate:   { type: Date },  // When it was actually paid (may differ from approval date)
    receiptNumber: { type: String, default: '', trim: true },  // Receipt/reference number
    
    // Payment method details (matching Sale schema pattern)
    bankProviderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'BankProvider' },
    bankProviderName:  { type: String, default: '' },
    customMethodId:    { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod' },
    customMethodName:  { type: String, default: '' },
    mpesaCode:         { type: String, default: '' },
    mpesaPhone:        { type: String, default: '' },
    
    status:        { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt:    Date,
    createdAt:     { type: Date, default: Date.now },
  },
  { collection: 'expenses' }
)
expenseSchema.index({ userId: 1, createdAt: -1 })
expenseSchema.index({ userId: 1, branchId: 1, createdAt: -1 })
expenseSchema.index({ userId: 1, status: 1 })

// ── Report ────────────────────────────────────────────────────────────────────
export const reportSchema = new mongoose.Schema(
  {
    userId:      { type: String, required: true, index: true },
    reportType:  { type: String, enum: ['sales', 'inventory', 'profit', 'custom', 'rentals'], required: true },
    title:       { type: String, required: true },
    description: String,
    dateRange: {
      startDate: { type: Date, required: true },
      endDate:   { type: Date, required: true },
    },
    data: {
      summary: { type: mongoose.Schema.Types.Mixed, default: {} },
      details: { type: [mongoose.Schema.Types.Mixed], default: [] },
      charts:  { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)
reportSchema.index({ userId: 1, reportType: 1, createdAt: -1 })

// ── StockLedger ────────────────────────────────────────────────────────────────
// Immutable ledger of every retail product stock movement.
// Written by the sales API on every completed sale, and by the inventory
// adjustment API on manual stock changes. Never updated — only inserted.
export const stockLedgerSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },  // Branch where movement occurred
    productId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    saleId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },       // set on sale
    staffId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    type: {
      type: String,
      enum: ['STOCK_IN', 'SALE', 'RETURN', 'DAMAGE', 'WASTAGE', 'EXPIRED', 'LOSS', 'ADJUSTMENT', 'IMPORT', 'MANUAL', 'TRANSFER_OUT', 'TRANSFER_IN', 'EXCHANGE_IN', 'EXCHANGE_OUT'],
      required: true,
    },
    quantity:        { type: Number, required: true },   // negative = stock out, positive = stock in
    previousStock:   { type: Number, required: true },
    newStock:        { type: Number, required: true },
    
    // Stock In specific fields
    supplierId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    supplierName:    { type: String, default: '' },      // denormalized for history
    unitCost:        { type: Number },                   // cost per unit for this movement
    totalCost:       { type: Number },                   // total value of this movement
    reference:       { type: String, default: '' },      // invoice/PO number
    
    // Lot / batch tracking — set when a movement involves a specific ProductBatch
    batchId:         { type: mongoose.Schema.Types.ObjectId, ref: 'ProductBatch' },
    lotLabel:        { type: String, default: '' },  // denormalized label for quick display

    // General fields
    reason:          { type: String, default: '' },
    notes:           { type: String, default: '' },
    orderNumber:     { type: String, default: '' },
    timestamp:       { type: Date, default: Date.now },
  },
  { collection: 'stock_ledger' }
)
stockLedgerSchema.index({ userId: 1, productId: 1, timestamp: -1 })
stockLedgerSchema.index({ userId: 1, branchId: 1, timestamp: -1 })
stockLedgerSchema.index({ userId: 1, saleId: 1 })
stockLedgerSchema.index({ userId: 1, supplierId: 1, timestamp: -1 })
stockLedgerSchema.index({ userId: 1, type: 1, timestamp: -1 })
stockLedgerSchema.index({ userId: 1, timestamp: -1 })
stockLedgerSchema.index({ userId: 1, batchId: 1, timestamp: -1 })  // lot-level movement history

// ── Supplier ───────────────────────────────────────────────────────────────────
// Manages supplier/vendor information for retail inventory.
// Tracks who supplies products and purchase history.
export const supplierSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:          { type: String, required: true, trim: true },
    contactPerson: { type: String, default: '', trim: true },
    phone:         { type: String, default: '', trim: true },
    email:         { type: String, default: '', trim: true },
    address:       { type: String, default: '', trim: true },
    notes:         { type: String, default: '' },
    isActive:      { type: Boolean, default: true },
    createdAt:     { type: Date, default: Date.now },
    updatedAt:     { type: Date, default: Date.now },
  },
  { collection: 'suppliers' }
)
supplierSchema.index({ userId: 1, isActive: 1 })
supplierSchema.index({ userId: 1, name: 1 })

// ── StockReceipt ──────────────────────────────────────────────────────────────
// Groups a stock-in session into a single receipt document with cost tracking.
// Created when stock is received from a supplier. Tracks payment status so
// the business can see money spent (paid) and money owed (unpaid = payables).
// For advance payments (prepaid), see Phase 3 — the schema accommodates it now.
export const stockReceiptSchema = new mongoose.Schema(
  {
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    receiptNumber:   { type: String, required: true, trim: true },  // SR-YYYY-NNNN
    date:            { type: Date, default: Date.now },

    // Supplier (who goods came from)
    supplierId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    supplierName:    { type: String, required: true, default: 'Unknown' },
    reference:       { type: String, default: '' },  // supplier's invoice/PO number

    // Line items
    items: [{
      moduleItemId: { type: String, required: true },  // product ID
      module:       { type: String, default: 'retail' },
      itemName:     { type: String, required: true },
      quantity:     { type: Number, required: true, min: 1 },
      unitPrice:    { type: Number, default: 0, min: 0 },
      lineTotal:    { type: Number, default: 0, min: 0 },
      batchId:      { type: mongoose.Schema.Types.ObjectId, ref: 'ProductBatch' },
    }],

    totalCost:       { type: Number, required: true, default: 0 },

    // Payment tracking — mirrors Sale.payments[] shape so the end-of-day
    // report's resolveMethodName() works on stock receipts without changes.
    paymentStatus:   { type: String, enum: ['paid', 'unpaid', 'prepaid'], default: 'paid' },
    paymentMethod:   { type: String, enum: ['cash', 'mobile_money', 'bank', 'custom', ''], default: '' },
    bankProviderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'BankProvider' },
    bankProviderName:{ type: String, default: '' },
    customMethodId:  { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod' },
    customMethodName:{ type: String, default: '' },
    paymentReference:{ type: String, default: '' },  // mpesa code, receipt number
    paidAt:          { type: Date },
    // Who settled/paid — populated when a payable is settled or advance is recorded
    settledBy:       { type: mongoose.Schema.Types.ObjectId },
    settledByModel:  { type: String, enum: ['User', 'Staff'], default: 'User' },

    notes:           { type: String, default: '' },
    createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByModel:  { type: String, enum: ['User', 'Staff'], default: 'User' },
    createdAt:       { type: Date, default: Date.now },
    updatedAt:       { type: Date, default: Date.now },
  },
  { collection: 'stock_receipts' }
)
stockReceiptSchema.index({ userId: 1, createdAt: -1 })
stockReceiptSchema.index({ userId: 1, paymentStatus: 1, createdAt: -1 })
stockReceiptSchema.index({ userId: 1, supplierId: 1, createdAt: -1 })
stockReceiptSchema.index({ userId: 1, receiptNumber: 1 }, { unique: true })
stockReceiptSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── ProductBatch ───────────────────────────────────────────────────────────────
// Tracks individual physical lots/units of a retail product.
// Only used when Product.trackLots === true.
// Examples: Roll A of 90m wire, Box 3 of 100 nails, Carton 2 of 24 bottles.
// Mirrors the pharmacy DrugBatch pattern but without expiry-date requirements.
export const productBatchSchema = new mongoose.Schema(
  {
    userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    productId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

    // ── Identity ──────────────────────────────────────────────────────────────
    // lotId is the system-generated unique reference (LOT-YYMMDD-XXXX).
    // lotLabel is the human-friendly display name staff can customise.
    lotId:            { type: String, required: true, trim: true },   // e.g. LOT-241022-A3BF
    lotLabel:         { type: String, default: '', trim: true },       // e.g. "Roll A", "Box 2"
    supplierLot:      { type: String, default: '', trim: true },       // supplier's own lot/batch number

    // ── Quantity tracking ─────────────────────────────────────────────────────
    quantity:         { type: Number, required: true, default: 0 },   // current remaining
    initialQuantity:  { type: Number, required: true },                // quantity when first received
    reservedQuantity: { type: Number, default: 0 },                   // held for pending sales

    // ── Pricing (optional per-lot override) ───────────────────────────────────
    buyingPrice:      { type: Number, required: true },
    sellingPrice:     { type: Number },                               // overrides product default when set

    // ── Provenance ────────────────────────────────────────────────────────────
    supplier:         { type: String, default: '' },
    invoiceNumber:    { type: String, default: '', trim: true },
    poReference:      { type: String, default: '', trim: true },
    receivedDate:     { type: Date, default: Date.now },

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    // active   — in use / available for sale
    // depleted — quantity reached zero from sales
    // sealed   — manually closed (e.g. damaged, set aside) before depletion
    status:           { type: String, enum: ['active', 'depleted', 'sealed'], default: 'active' },

    notes:            { type: String, default: '' },
    createdAt:        { type: Date, default: Date.now },
    updatedAt:        { type: Date, default: Date.now },
  },
  { collection: 'product_batches' }
)
// FIFO query — sort by receivedDate ascending to consume oldest lots first
productBatchSchema.index({ userId: 1, branchId: 1, productId: 1, receivedDate: 1 })
productBatchSchema.index({ userId: 1, branchId: 1, status: 1 })
productBatchSchema.index({ userId: 1, branchId: 1, productId: 1, status: 1 })
productBatchSchema.index({ userId: 1, branchId: 1, lotId: 1 }, { unique: true })
productBatchSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── DrugBatch ─────────────────────────────────────────────────────────────────
// Tracks individual stock batches per drug for FEFO, expiry, and batch recall
export const drugBatchSchema = new mongoose.Schema(
  {
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    drugId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Drug', required: true },
    internalBatchId: { type: String, required: true, trim: true },
    manufacturerLot: { type: String, default: '', trim: true },
    expiryDate:      { type: Date, required: true },
    manufactureDate: { type: Date },
    quantity:        { type: Number, required: true, default: 0 },  // current qty in this batch
    initialQuantity: { type: Number, required: true },              // qty when received
    reservedQuantity:{ type: Number, default: 0 },                  // qty reserved for held sales/transfers
    buyingPrice:     { type: Number, required: true },
    sellingPrice:    { type: Number },                              // override drug default if set
    supplier:        { type: String, default: '' },
    invoiceNumber:   { type: String, default: '', trim: true },
    poReference:     { type: String, default: '', trim: true },
    receivedDate:    { type: Date, default: Date.now },
    status:          { type: String, enum: ['active', 'expired', 'recalled', 'depleted', 'quarantined'], default: 'active' },
    notes:           { type: String, default: '' },
    createdAt:       { type: Date, default: Date.now },
    updatedAt:       { type: Date, default: Date.now },
  },
  { collection: 'drug_batches' }
)
drugBatchSchema.index({ userId: 1, branchId: 1, drugId: 1, expiryDate: 1 })  // FEFO query
drugBatchSchema.index({ userId: 1, branchId: 1, status: 1 })
drugBatchSchema.index({ userId: 1, branchId: 1, expiryDate: 1 })              // expiry alerts
drugBatchSchema.index({ userId: 1, branchId: 1, internalBatchId: 1 }, { unique: true })
drugBatchSchema.index({ userId: 1, branchId: 1, manufacturerLot: 1 })
drugBatchSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── Drug ──────────────────────────────────────────────────────────────────────
// Separate pharmacy drug catalog — independent from POS products
export const drugSchema = new mongoose.Schema(
  {
    userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // Optional for global drugs, required for branch-specific
    genericName:      { type: String, required: true, trim: true },
    brandName:        { type: String, default: '', trim: true },
    sku:              { type: String, default: '', trim: true },
    category:         { type: String, default: 'General', trim: true }, // Antibiotics, Analgesics, etc.
    drugClass:        { type: String, default: '' },
    dosageForm:       { type: String, default: '' }, // Tablet, Capsule, Syrup, Injection, etc.
    strength:         { type: String, default: '' }, // e.g. 500mg, 250mg/5ml
    unit:             { type: String, default: 'Tablet' }, // Tablet, Strip, Bottle, Vial
    barcode:          { type: String, default: '' },
    sellingPrice:     { type: Number, required: true, default: 0 },
    buyingPrice:      { type: Number, required: true, default: 0 },
    wholesalePrice:   { type: Number, default: 0 },
    stock:            { type: Number, default: 0 },  // computed from active batches
    reorderLevel:     { type: Number, default: 10 },
    requiresPrescription: { type: Boolean, default: false },
    isControlled:     { type: Boolean, default: false }, // narcotics, etc.
    status:           { type: String, enum: ['active', 'inactive', 'discontinued'], default: 'active' },
    description:      { type: String, default: '' },
    sideEffects:      { type: String, default: '' },
    manufacturer:     { type: String, default: '' },
    isActive:         { type: Boolean, default: true },
    createdAt:        { type: Date, default: Date.now },
    updatedAt:        { type: Date, default: Date.now },
  },
  { collection: 'drugs' }
)
drugSchema.index({ userId: 1, genericName: 1 })
drugSchema.index({ userId: 1, barcode: 1 })
drugSchema.index({ userId: 1, category: 1 })
drugSchema.index({ userId: 1, sku: 1 })
drugSchema.index({ userId: 1, branchId: 1 })
drugSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── Branch ─────────────────────────────────────────────────────────────────────
// Multi-branch support for pharmacy operations
export const branchSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    phones: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'inactive', 'closed'], default: 'active' },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'branches' }
)
branchSchema.index({ userId: 1, status: 1 })
branchSchema.index({ userId: 1, code: 1 }, { unique: true })
branchSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── MobileShop ─────────────────────────────────────────────────────────────────
// Field sales operations with temporary sellers
export const mobileShopSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true }, // e.g., "Market Day - Gikomba"
    sourceBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    
    // Stock tracking
    stockOut: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      productName: { type: String, required: true },
      quantity: { type: Number, required: true },
      deployedAt: { type: Date, default: Date.now }
    }],
    stockReturned: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      productName: { type: String, required: true },
      quantity: { type: Number, required: true },
      returnedAt: { type: Date, default: Date.now }
    }],
    
    // Sellers assigned to this shop
    sellers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],
    
    // Sales summary (calculated on close)
    salesMade: {
      totalRevenue: { type: Number, default: 0 },
      salesCount: { type: Number, default: 0 },
      itemsSold: { type: Number, default: 0 }
    },
    
    // Stock variance (calculated on close)
    variance: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      productName: { type: String },
      expected: { type: Number }, // stockOut - sold
      actual: { type: Number },   // stockReturned
      difference: { type: Number }, // actual - expected (negative = loss, positive = gain)
      notes: { type: String }
    }],
    
    // Lifecycle
    deployedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    notes: { type: String, default: '' },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'mobile_shops' }
)
mobileShopSchema.index({ userId: 1, status: 1 })
mobileShopSchema.index({ userId: 1, sourceBranchId: 1 })
mobileShopSchema.index({ userId: 1, deployedAt: -1 })
mobileShopSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── Inventory ───────────────────────────────────────────────────────────────────
// Pharmacy inventory - derived from transactions, not directly edited
export const inventorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    drugId: { type: mongoose.Schema.Types.ObjectId, ref: 'Drug', required: true },
    quantityAvailable: { type: Number, required: true, default: 0 },
    quantityReserved: { type: Number, required: true, default: 0 },
    reorderLevel: { type: Number, default: 10 },
    lastStockUpdate: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'inventory' }
)
inventorySchema.index({ userId: 1, branchId: 1, drugId: 1 }, { unique: true })
inventorySchema.index({ userId: 1, branchId: 1 })
inventorySchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── InventoryTransaction ────────────────────────────────────────────────────────
// Immutable ledger of all stock movements - system of truth
export const inventoryTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    drugId: { type: mongoose.Schema.Types.ObjectId, ref: 'Drug', required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'DrugBatch' },
    type: {
      type: String,
      enum: ['IN', 'OUT', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'DISPOSAL', 'RETURN'],
      required: true,
    },
    quantity: { type: Number, required: true },
    previousBalance: { type: Number, required: true },
    newBalance: { type: Number, required: true },
    referenceId: { type: String }, // Sale ID, Transfer ID, etc.
    referenceType: { type: String }, // 'sale', 'transfer', 'adjustment', etc.
    userIdPerformed: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    reason: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'inventory_transactions' }
)
inventoryTransactionSchema.index({ userId: 1, branchId: 1, drugId: 1, timestamp: -1 })
inventoryTransactionSchema.index({ userId: 1, branchId: 1, timestamp: -1 })
inventoryTransactionSchema.index({ userId: 1, referenceId: 1 })
// Immutable - no updates allowed


// ── PurchaseOrder ──────────────────────────────────────────────────────────────
// Purchase orders generated from restocking analysis
// Does NOT automatically increase inventory - PO creation is separate from receiving
const purchaseOrderItemSchema = new mongoose.Schema(
  {
    moduleItemId: { type: String, required: true },  // Reference back to source item
    module:       { type: String, required: true },  // 'retail', 'bar', 'pharmacy', etc.
    itemName:     { type: String, required: true },
    quantity:     { type: Number, required: true, min: 1 },
    unitPrice:    { type: Number, default: 0, min: 0 },  // estimate — confirmed at receiving/quote
    lineTotal:    { type: Number, default: 0, min: 0 },  // estimate — confirmed at receiving/quote
  },
  { _id: false }
)

export const purchaseOrderSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    poNumber:     { type: String, required: true, unique: true },  // e.g., 'PO-2026-001'
    supplierId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    supplierName: { type: String, required: true },
    status:       { type: String, enum: ['draft', 'approved', 'sent', 'received', 'cancelled'], default: 'draft' },
    items:        { type: [purchaseOrderItemSchema], required: true },
    subtotal:     { type: Number, required: true, default: 0 },
    total:        { type: Number, required: true, default: 0 },
    notes:        { type: String, default: '' },
    editHistory: [{
      editedBy:    { type: mongoose.Schema.Types.ObjectId, refPath: 'editHistory.editedByModel' },
      editedByModel: { type: String, enum: ['User', 'Staff'], default: 'User' },
      editedAt:    { type: Date, default: Date.now },
      changes: [{
        field:     { type: String, required: true },
        oldValue:  { type: mongoose.Schema.Types.Mixed },
        newValue:  { type: mongoose.Schema.Types.Mixed },
      }]
    }],
    createdBy:    { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel' },
    createdByModel: { type: String, enum: ['User', 'Staff'], default: 'User' },
    createdAt:    { type: Date, default: Date.now },
    updatedAt:    { type: Date, default: Date.now },
  },
  { collection: 'purchase_orders' }
)
purchaseOrderSchema.index({ userId: 1, createdAt: -1 })
purchaseOrderSchema.index({ userId: 1, status: 1, createdAt: -1 })
purchaseOrderSchema.index({ userId: 1, supplierId: 1, createdAt: -1 })
purchaseOrderSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── Quotation ──────────────────────────────────────────────────────────────────
// Customer quotations - similar to purchase orders but for selling
const quotationItemSchema = new mongoose.Schema(
  {
    productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    quantity:    { type: Number, required: true, min: 1 },
    unitPrice:   { type: Number, required: true, min: 0 },
    lineTotal:   { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

export const quotationSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    quotationNumber: { type: String, required: true, unique: true },  // e.g., 'QT-2026-001'
    customerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    status:       { type: String, enum: ['draft', 'sent', 'accepted', 'expired', 'converted'], default: 'draft' },
    items:        { type: [quotationItemSchema], required: true },
    subtotal:     { type: Number, required: true, default: 0 },
    discount:     { type: Number, default: 0 },
    total:        { type: Number, required: true, default: 0 },
    validUntil:   { type: Date, required: true },
    notes:        { type: String, default: '' },
    convertedToSaleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel' },
    createdByModel: { type: String, enum: ['User', 'Staff'], default: 'User' },
    createdAt:    { type: Date, default: Date.now },
    updatedAt:    { type: Date, default: Date.now },
  },
  { collection: 'quotations' }
)
quotationSchema.index({ userId: 1, createdAt: -1 })
quotationSchema.index({ userId: 1, status: 1, createdAt: -1 })
quotationSchema.index({ userId: 1, customerId: 1, createdAt: -1 })
quotationSchema.index({ quotationNumber: 1 }, { unique: true })
quotationSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── RestockPlan ────────────────────────────────────────────────────────────────
// History of restocking analysis and recommendations
const restockRecommendationSchema = new mongoose.Schema(
  {
    moduleItemId:    { type: String, required: true },
    module:          { type: String, required: true },
    itemName:        { type: String, required: true },
    currentStock:    { type: Number, required: true },
    velocity:        { type: Number, required: true },  // average daily sales
    daysRemaining:   { type: Number, required: true },
    urgency:         { type: Number, required: true },  // leadTime / daysRemaining
    recommendedQty:  { type: Number, required: true },
    allocatedQty:    { type: Number, default: 0 },  // actual quantity allocated (may be partial)
    unitPrice:       { type: Number, required: true },
    totalCost:       { type: Number, required: true },
    reason:          { type: String, default: '' },  // explanation for user
    deferred:        { type: Boolean, default: false },
    deferredReason:  { type: String, default: '' },
  },
  { _id: false }
)

export const restockPlanSchema = new mongoose.Schema(
  {
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    planType:       { type: String, enum: ['low-stock', 'generate', 'assisted'], required: true },
    leadTimeDays:   { type: Number, required: true, default: 7 },
    safetyBufferDays: { type: Number, default: 2 },
    budget:         { type: Number },  // null for non-assisted plans
    
    recommendations: { type: [restockRecommendationSchema], default: [] },
    
    totalRecommendedCost: { type: Number, default: 0 },
    totalAllocatedCost:   { type: Number, default: 0 },
    itemsRecommended:     { type: Number, default: 0 },
    itemsDeferred:        { type: Number, default: 0 },
    
    createdBy:    { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel' },
    createdByModel: { type: String, enum: ['User', 'Staff'], default: 'User' },
    createdAt:    { type: Date, default: Date.now },
    
    purchaseOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' }],  // POs generated from this plan
  },
  { collection: 'restock_plans' }
)
restockPlanSchema.index({ userId: 1, createdAt: -1 })
restockPlanSchema.index({ userId: 1, planType: 1, createdAt: -1 })

// ══════════════════════════════════════════════════════════════════════════════
// HOSPITALITY MODULE SCHEMAS
// ══════════════════════════════════════════════════════════════════════════════
// Specialized inventory and sales system for food and beverage businesses
// Supports fractional inventory tracking, multiple serving types, and production logs

// ── HospitalityMenuItem ────────────────────────────────────────────────────────
// Primary inventory items (products and ingredients)
export const hospitalityMenuItemSchema = new mongoose.Schema(
  {
    tenantId:     { type: String, required: true, index: true },
    name:         { type: String, required: true },
    description:  { type: String, default: '' },
    category:     { type: String, required: true },
    sku:          { type: String, default: '' },
    barcode:      { type: String, default: '' },
    images:       { type: [String], default: [] },
    
    // Item classification
    itemType:     { type: String, enum: ['for-sale', 'ingredient'], required: true, default: 'for-sale' },
    isServable:   { type: Boolean, default: false },  // true = supports servings, false = whole-only
    servingMode:  { type: String, enum: ['fraction', 'volume'], default: null },  // calculation mode
    
    // Unit configuration
    baseUnit:     { type: String, default: 'unit' },  // 'bottle', 'fruit', 'liter', 'bar', etc.
    
    // Pricing (for non-servable items or ingredients)
    wholePriceIfNotServable: { type: Number, default: 0 },  // price when sold as whole
    costPrice:    { type: Number, default: 0 },
    
    // Inventory configuration
    reorderPoint:      { type: Number, default: 10 },
    inventoryMode:     { type: String, enum: ['tracked', 'untracked'], default: 'tracked' },
    canConsolidate:    { type: Boolean, default: false },  // whether partial units can be physically consolidated
    
    status:       { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdAt:    { type: Date, default: Date.now },
    updatedAt:    { type: Date, default: Date.now },
  },
  { collection: 'hospitality_menu_items' }
)
hospitalityMenuItemSchema.index({ tenantId: 1, name: 1 })
hospitalityMenuItemSchema.index({ tenantId: 1, category: 1 })
hospitalityMenuItemSchema.index({ tenantId: 1, itemType: 1, status: 1 })
hospitalityMenuItemSchema.index({ tenantId: 1, barcode: 1 })
hospitalityMenuItemSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── HospitalityServingType ─────────────────────────────────────────────────────
// Serving definitions per menu item
export const hospitalityServingTypeSchema = new mongoose.Schema(
  {
    tenantId:          { type: String, required: true, index: true },
    menuItemId:        { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalityMenuItem', required: true },
    name:              { type: String, required: true },  // 'Tot', 'Prime', 'Quick', '250ml', 'Slice'
    servingsPerUnit:   { type: Number, required: true, min: 1 },  // 20 tots per bottle, 8 slices per fruit
    pricePerServing:   { type: Number, required: true, min: 0 },
    volume:            { type: Number, default: null },  // for volume-based: 250 (ml)
    isDefault:         { type: Boolean, default: false },  // default serving type in POS
    displayOrder:      { type: Number, default: 0 },
    createdAt:         { type: Date, default: Date.now },
    updatedAt:         { type: Date, default: Date.now },
  },
  { collection: 'hospitality_serving_types' }
)
hospitalityServingTypeSchema.index({ tenantId: 1, menuItemId: 1 })
hospitalityServingTypeSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── HospitalityServingInventory ────────────────────────────────────────────────
// Current stock levels with partial tracking
const partialUnitSchema = new mongoose.Schema(
  {
    id:                { type: String, required: true },  // unique identifier
    servingsRemaining: { type: mongoose.Schema.Types.Mixed, default: {} },  // { servingTypeId: remaining }
    openedAt:          { type: Date, default: Date.now },
    batchId:           { type: String, default: null },  // for traceability
  },
  { _id: false }
)

export const hospitalityServingInventorySchema = new mongoose.Schema(
  {
    tenantId:              { type: String, required: true, index: true },
    menuItemId:            { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalityMenuItem', required: true },
    wholeUnits:            { type: Number, default: 0, min: 0 },  // complete unopened units
    partialUnits:          { type: [partialUnitSchema], default: [] },
    totalAvailableServings: { type: mongoose.Schema.Types.Mixed, default: {} },  // { servingTypeId: total }
    lastUpdated:           { type: Date, default: Date.now },
    lastCountedAt:         { type: Date, default: Date.now },  // physical stock count
    variance:              { type: Number, default: 0 },  // difference from expected
  },
  { collection: 'hospitality_serving_inventory' }
)
hospitalityServingInventorySchema.index({ tenantId: 1, menuItemId: 1 }, { unique: true })
hospitalityServingInventorySchema.pre('save', function (next) { (this as any).lastUpdated = new Date(); next() })

// ── HospitalityServingMovement ─────────────────────────────────────────────────
// Audit trail for all inventory changes
export const hospitalityServingMovementSchema = new mongoose.Schema(
  {
    tenantId:       { type: String, required: true, index: true },
    menuItemId:     { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalityMenuItem', required: true },
    movementType:   { 
      type: String, 
      enum: ['sale', 'receive', 'production', 'adjustment', 'waste', 'consolidation'], 
      required: true 
    },
    servingTypeId:  { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalityServingType', default: null },
    quantity:       { type: Number, required: true },  // servings moved
    wholeUnitsChanged: { type: Number, default: 0 },
    
    // Snapshot of state before and after
    beforeState: {
      wholeUnits:    { type: Number, default: 0 },
      partialUnits:  { type: Number, default: 0 },
      totalServings: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    afterState: {
      wholeUnits:    { type: Number, default: 0 },
      partialUnits:  { type: Number, default: 0 },
      totalServings: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    
    reason:         { type: String, default: '' },  // for manual movements
    referenceType:  { type: String, enum: ['sale', 'production', 'adjustment', 'other'], default: 'other' },
    referenceId:    { type: mongoose.Schema.Types.ObjectId, default: null },  // link to source transaction
    performedBy:    { type: mongoose.Schema.Types.ObjectId, default: null },  // staff/user who performed action
    approvedBy:     { type: mongoose.Schema.Types.ObjectId, default: null },  // for adjustments requiring approval
    timestamp:      { type: Date, default: Date.now },
    metadata:       { type: mongoose.Schema.Types.Mixed, default: {} },  // additional context
  },
  { collection: 'hospitality_serving_movements' }
)
hospitalityServingMovementSchema.index({ tenantId: 1, menuItemId: 1, timestamp: -1 })
hospitalityServingMovementSchema.index({ tenantId: 1, movementType: 1, timestamp: -1 })
hospitalityServingMovementSchema.index({ tenantId: 1, timestamp: -1 })

// ── HospitalityProductionLog ───────────────────────────────────────────────────
// Kitchen/bar production tracking
const productionIngredientSchema = new mongoose.Schema(
  {
    itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalityMenuItem', required: true },
    itemName:     { type: String, required: true },
    quantityUsed: { type: Number, required: true },
    unit:         { type: String, required: true },
  },
  { _id: false }
)

export const hospitalityProductionLogSchema = new mongoose.Schema(
  {
    tenantId:           { type: String, required: true, index: true },
    productionDate:     { type: Date, default: Date.now },
    producedItemId:     { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalityMenuItem', required: true },
    servingTypeId:      { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalityServingType', default: null },
    expectedYield:      { type: Number, required: true },  // servings expected
    actualYield:        { type: Number, required: true },  // servings actually produced
    variance:           { type: Number, default: 0 },  // actualYield - expectedYield
    variancePercentage: { type: Number, default: 0 },
    ingredientsUsed:    { type: [productionIngredientSchema], default: [] },
    notes:              { type: String, default: '' },
    producedBy:         { type: mongoose.Schema.Types.ObjectId, default: null },
    approvedBy:         { type: mongoose.Schema.Types.ObjectId, default: null },
    status:             { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    createdAt:          { type: Date, default: Date.now },
  },
  { collection: 'hospitality_production_logs' }
)
hospitalityProductionLogSchema.index({ tenantId: 1, productionDate: -1 })
hospitalityProductionLogSchema.index({ tenantId: 1, producedItemId: 1, productionDate: -1 })
hospitalityProductionLogSchema.index({ tenantId: 1, status: 1 })

// ── HospitalityOrder ───────────────────────────────────────────────────────────
// Sales orders (links to main sales system)
const hospitalityOrderItemSchema = new mongoose.Schema(
  {
    menuItemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalityMenuItem', required: true },
    name:             { type: String, required: true },
    quantity:         { type: Number, required: true, min: 1 },  // whole units ordered
    servingTypeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalityServingType', default: null },
    servingTypeName:  { type: String, default: '' },
    servingsOrdered:  { type: Number, default: null },  // null for whole-only items
    pricePerUnit:     { type: Number, required: true },
    totalPrice:       { type: Number, required: true },
  },
  { _id: false }
)

export const hospitalityOrderSchema = new mongoose.Schema(
  {
    tenantId:          { type: String, required: true, index: true },
    orderNumber:       { type: String, required: true },
    items:             { type: [hospitalityOrderItemSchema], required: true },
    subtotal:          { type: Number, required: true },
    tax:               { type: Number, default: 0 },
    total:             { type: Number, required: true },
    paymentMethod:     { type: String, enum: ['cash', 'card', 'mobile_money', 'credit'], required: true },
    paymentStatus:     { type: String, enum: ['pending', 'paid', 'refunded'], default: 'paid' },
    customerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    servedBy:          { type: mongoose.Schema.Types.ObjectId, default: null },
    tableNumber:       { type: String, default: '' },
    orderType:         { type: String, enum: ['dine-in', 'takeaway', 'delivery'], default: 'dine-in' },
    status:            { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'completed' },
    createdAt:         { type: Date, default: Date.now },
    completedAt:       { type: Date, default: Date.now },
  },
  { collection: 'hospitality_orders' }
)
hospitalityOrderSchema.index({ tenantId: 1, createdAt: -1 })
hospitalityOrderSchema.index({ tenantId: 1, status: 1 })
hospitalityOrderSchema.index({ tenantId: 1, orderNumber: 1 })

// ── HospitalityCategory ────────────────────────────────────────────────────────
// Menu categories (Drinks, Food, Snacks, Desserts, etc.)
export const hospitalityCategorySchema = new mongoose.Schema(
  {
    tenantId:    { type: String, required: true, index: true },
    name:        { type: String, required: true },
    description: { type: String, default: '' },
    color:       { type: String, default: '#3b82f6' },
    icon:        { type: String, default: 'utensils' },
    displayOrder: { type: Number, default: 0 },
    isVisible:   { type: Boolean, default: true },
    createdAt:   { type: Date, default: Date.now },
    updatedAt:   { type: Date, default: Date.now },
  },
  { collection: 'hospitality_categories' }
)
hospitalityCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true })
hospitalityCategorySchema.index({ tenantId: 1, displayOrder: 1 })
hospitalityCategorySchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })

// ── StockTransfer ──────────────────────────────────────────────────────────────
// Inter-branch stock transfers
const stockTransferItemSchema = new mongoose.Schema(
  {
    productId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    drugId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Drug' },
    itemName:         { type: String, required: true },
    quantitySent:     { type: Number, required: true, min: 1 },
    quantityReceived: { type: Number, default: null },  // Set when received
    unitPrice:        { type: Number, default: 0 },
  },
  { _id: false }
)

export const stockTransferSchema = new mongoose.Schema(
  {
    userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transferNumber:   { type: String, required: true, unique: true },
    fromBranchId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    toBranchId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    items:            { type: [stockTransferItemSchema], required: true },
    status:           { type: String, enum: ['pending_receipt', 'received', 'rejected'], default: 'pending_receipt' },
    createdBy:        { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel' },
    createdByModel:   { type: String, enum: ['User', 'Staff'], default: 'User' },
    receivedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    rejectedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    notes:            { type: String, default: '' },
    rejectionReason:  { type: String, default: '' },
    createdAt:        { type: Date, default: Date.now },
    receivedAt:       Date,
    rejectedAt:       Date,
  },
  { collection: 'stock_transfers' }
)
stockTransferSchema.index({ userId: 1, createdAt: -1 })
stockTransferSchema.index({ userId: 1, fromBranchId: 1, status: 1 })
stockTransferSchema.index({ userId: 1, toBranchId: 1, status: 1 })

// ── Notification ───────────────────────────────────────────────────────────────
// Real-time notifications for staff and users
export const notificationSchema = new mongoose.Schema(
  {
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId:    { type: mongoose.Schema.Types.ObjectId, required: true },  // Staff or User ID
    recipientType:  { type: String, enum: ['user', 'staff'], required: true },
    type:           { type: String, enum: ['transfer_received', 'transfer_rejected', 'info'], required: true },
    title:          { type: String, required: true },
    message:        { type: String, required: true },
    referenceId:    { type: mongoose.Schema.Types.ObjectId },  // Transfer ID, Sale ID, etc.
    referenceType:  { type: String, enum: ['stock_transfer', 'sale', 'other'], default: 'other' },
    isRead:         { type: Boolean, default: false },
    createdAt:      { type: Date, default: Date.now },
    readAt:         Date,
  },
  { collection: 'notifications' }
)
notificationSchema.index({ userId: 1, recipientId: 1, isRead: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, recipientId: 1, createdAt: -1 })

// ── BankProvider ───────────────────────────────────────────────────────────────
// Dynamic bank payment providers for flexible payment tracking
export const bankProviderSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:       { type: String, required: true, trim: true },
    isActive:   { type: Boolean, default: true },
    createdAt:  { type: Date, default: Date.now },
  },
  { collection: 'bank_providers' }
)
bankProviderSchema.index({ userId: 1, name: 1 }, { unique: true })
bankProviderSchema.index({ userId: 1, isActive: 1 })

// ── PaymentMethod ──────────────────────────────────────────────────────────────
// Custom payment methods (Airtel Money, Vouchers, Bank Deposit, etc.)
// For user-defined payment types beyond the built-in methods
export const paymentMethodSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:       { type: String, required: true, trim: true },
    type:       { type: String, enum: ['mobile_money', 'bank', 'voucher', 'card', 'other'], default: 'other' },
    isActive:   { type: Boolean, default: true },
    createdAt:  { type: Date, default: Date.now },
  },
  { collection: 'payment_methods' }
)
paymentMethodSchema.index({ userId: 1, name: 1 }, { unique: true })
paymentMethodSchema.index({ userId: 1, isActive: 1 })

// ── Deposit ────────────────────────────────────────────────────────────────────
// Customer prepayments ("store credit / wallet"). A deposit is money the
// customer pays UPFRONT (real cash by method — already counted in the day's
// per-method totals) that they later draw down against one or more pickups.
//
// Lifecycle:
//   Day 1 — POST /api/deposits      → status 'active',  balance = amount
//   Day N — pickup (sale, deposit)  → status 'partial' | 'used',  balance -= draw
//                                     (one consumptions[] entry per pickup)
//   Day M — refund                  → balance -= refund,  status 'refunded' when 0
//                                     (one refunds[] entry per refund event)
//
// The Customer.depositBalance field mirrors the sum of all active Deposit
// balances for that customer; the two are kept in sync by the deposit APIs.
// NEVER net depositBalance against creditBalance (debt) — every cent must stay
// attributable to its original payment method in reports.

// One pickup drawing down a deposit. Append-only; never edited.
const depositConsumptionSchema = new mongoose.Schema(
  {
    saleId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
    orderNumber:{ type: String, default: '' },          // denormalized for receipts/reports
    amount:     { type: Number, required: true, min: 0 },
    date:       { type: Date, default: Date.now },
    cashierId:  { type: mongoose.Schema.Types.ObjectId },           // who processed the pickup
    cashierModel:{ type: String, enum: ['User', 'Staff'], default: 'User' },
    note:       { type: String, default: '' },
  },
  { _id: true }
)

// One refund event returning prepayment to the customer. Real cash OUTFLOW on
// the refund day — tracked by method in reports. Multiple partial refunds are
// allowed, hence the array.
const depositRefundSchema = new mongoose.Schema(
  {
    amount:            { type: Number, required: true, min: 0 },
    // Method used to pay the refund out. Defaults to the deposit's original
    // method; an override requires approval (approvedBy).
    method:            { type: String, enum: ['cash', 'card', 'mobile_money', 'bank', 'custom'], required: true },
    bankProviderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'BankProvider' },
    bankProviderName:  { type: String, default: '' },
    customMethodId:    { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod' },
    customMethodName:  { type: String, default: '' },
    paymentReference:  { type: String, default: '' },   // mpesa code, receipt no, etc.
    reason:            { type: String, required: true },
    refundedBy:        { type: mongoose.Schema.Types.ObjectId, required: true },
    refundedByModel:   { type: String, enum: ['User', 'Staff'], default: 'User' },
    approvedBy:        { type: mongoose.Schema.Types.ObjectId },  // required when method differs from deposit.method
    approvedByModel:   { type: String, enum: ['User', 'Staff'], default: 'User' },
    refundedAt:        { type: Date, default: Date.now },
  },
  { _id: true }
)

export const depositSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },           // where deposit was taken
    receiptNo:     { type: String, required: true, trim: true },                       // DEP-YYYY-NNNN
    customerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName:  { type: String, default: '' },                                      // denormalized for reports/receipts
    customerPhone: { type: String, default: '' },

    amount:        { type: Number, required: true, min: 0.01 },                        // original prepayment
    balance:       { type: Number, required: true, default: 0, min: 0 },               // remaining (amount − consumptions − refunds)
    status:        { type: String, enum: ['active', 'partial', 'used', 'refunded', 'void'], default: 'active' },

    // Original payment method — this is what the day-1 per-method report counts.
    method:              { type: String, enum: ['cash', 'card', 'mobile_money', 'bank', 'custom'], required: true },
    bankProviderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'BankProvider' },
    bankProviderName:    { type: String, default: '' },
    customMethodId:      { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod' },
    customMethodName:    { type: String, default: '' },
    mpesaCode:           { type: String, default: '' },
    mpesaPhone:          { type: String, default: '' },
    paymentReference:    { type: String, default: '' },                                // generic reference (cheque no, etc.)

    // Append-only history
    consumptions: { type: [depositConsumptionSchema], default: [] },
    refunds:      { type: [depositRefundSchema], default: [] },

    note:          { type: String, default: '' },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, required: true },
    createdByModel: { type: String, enum: ['User', 'Staff'], default: 'User' },
    createdAt:     { type: Date, default: Date.now },
    updatedAt:     { type: Date, default: Date.now },
  },
  { collection: 'deposits' }
)
depositSchema.index({ userId: 1, createdAt: -1 })
depositSchema.index({ userId: 1, customerId: 1, status: 1, createdAt: -1 })  // active deposits for a customer
depositSchema.index({ userId: 1, branchId: 1, status: 1, createdAt: -1 })   // report scope
depositSchema.index({ userId: 1, receiptNo: 1 }, { unique: true })
depositSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next() })
