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
    staffId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    orderNumber:   { type: String, index: true },
    customerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName:  { type: String, default: '' },
    items: [{
      productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
      productName: { type: String, required: true },
      quantity:    { type: Number, required: true },
      price:       { type: Number, required: true },
      discount:    { type: Number, default: 0 },
    }],
    subtotal:      Number,
    discount:      { type: Number, default: 0 },
    total:         { type: Number, required: true },
    amountPaid:    { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['cash', 'card', 'mobile_money', 'credit'], required: true },
    mpesaCode:     String,
    mpesaPhone:    String,
    creditApplied: { type: Number, default: 0 },
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
    }],
    totalReturned:        { type: Number, default: 0 },
    isPartiallyReturned:  { type: Boolean, default: false },
    isFullyReturned:      { type: Boolean, default: false },
    status:    { type: String, enum: ['completed', 'pending', 'held', 'refunded', 'partially_refunded'], default: 'completed' },
    synced:    { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'sales' }
)
saleSchema.index({ userId: 1, createdAt: -1 })
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
    ledger: [{
      date:        { type: Date, default: Date.now },
      type:        { type: String, enum: ['purchase', 'payment', 'adjustment'] },
      amount:      Number,   // positive = debt added, negative = debt reduced
      balance:     Number,   // running balance after this entry
      saleId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
      note:        String,
    }],
    createdAt:     { type: Date, default: Date.now },
  },
  { collection: 'customers' }
)
customerSchema.index({ userId: 1, name: 1 })
customerSchema.index({ userId: 1, phone: 1 })

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
    branchId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // Branch assignment
    isBranchManager:     { type: Boolean, default: false }, // Branch manager flag
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
    active:    { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'staff' }
)
staffSchema.index({ userId: 1, email: 1 })
staffSchema.index({ userId: 1, branchId: 1 })
staffSchema.index({ userId: 1, isBranchManager: 1 })
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
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    staffId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    title:      { type: String, required: true, trim: true },
    category:   { type: String, required: true },
    notes:      { type: String, default: '' },
    amount:     { type: Number, required: true },
    date:       { type: Date, default: Date.now },
    status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    createdAt:  { type: Date, default: Date.now },
  },
  { collection: 'expenses' }
)
expenseSchema.index({ userId: 1, createdAt: -1 })

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
    productId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    saleId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },       // set on sale
    staffId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    type: {
      type: String,
      enum: ['STOCK_IN', 'SALE', 'RETURN', 'DAMAGE', 'WASTAGE', 'EXPIRED', 'LOSS', 'ADJUSTMENT', 'IMPORT', 'MANUAL', 'TRANSFER_OUT', 'TRANSFER_IN'],
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
    
    // General fields
    reason:          { type: String, default: '' },
    notes:           { type: String, default: '' },
    orderNumber:     { type: String, default: '' },
    timestamp:       { type: Date, default: Date.now },
  },
  { collection: 'stock_ledger' }
)
stockLedgerSchema.index({ userId: 1, productId: 1, timestamp: -1 })
stockLedgerSchema.index({ userId: 1, saleId: 1 })
stockLedgerSchema.index({ userId: 1, supplierId: 1, timestamp: -1 })
stockLedgerSchema.index({ userId: 1, type: 1, timestamp: -1 })
stockLedgerSchema.index({ userId: 1, timestamp: -1 })

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
    unitPrice:    { type: Number, required: true, min: 0 },
    lineTotal:    { type: Number, required: true, min: 0 },
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
