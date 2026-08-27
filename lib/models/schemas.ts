// ─── Raw schemas — imported by the model factory ──────────────────────────────
// These are schema definitions only, NOT bound to any connection.
// The factory in lib/tenant/get-models.ts binds them per-tenant connection.

import mongoose from 'mongoose'
import bcryptjs from 'bcryptjs'


// ── Product ───────────────────────────────────────────────────────────────────
export const productSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
    stock:        { type: Number, required: true, default: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    createdAt:    { type: Date, default: Date.now },
    updatedAt:    { type: Date, default: Date.now },
  },
  { collection: 'products' }
)
productSchema.index({ userId: 1, productName: 1 })
productSchema.index({ userId: 1, category: 1 })

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
    source:        { type: String, enum: ['pos', 'bar', 'kds', 'rental'], default: 'pos' },
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
    status:    { type: String, enum: ['completed', 'pending', 'held', 'refunded'], default: 'completed' },
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
        'kds.menu': false,
        'kds.inventory': false,
        'kds.orders': false,
        'kds.chef': false,
        'kds.waiter': false,
        'kds.history': false,
        'bar.tabs': false,
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
      enum: ['SALE', 'ADJUSTMENT', 'RETURN', 'IMPORT', 'MANUAL'],
      required: true,
    },
    quantity:        { type: Number, required: true },   // negative = stock out, positive = stock in
    previousStock:   { type: Number, required: true },
    newStock:        { type: Number, required: true },
    reason:          { type: String, default: '' },
    orderNumber:     { type: String, default: '' },
    timestamp:       { type: Date, default: Date.now },
  },
  { collection: 'stock_ledger' }
)
stockLedgerSchema.index({ userId: 1, productId: 1, timestamp: -1 })
stockLedgerSchema.index({ userId: 1, saleId: 1 })
stockLedgerSchema.index({ userId: 1, timestamp: -1 })

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


// ── BarBrand ───────────────────────────────────────────────────────────────────
// Represents a spirits/wine/beer brand (e.g. Jameson, Tusker, Château Margaux)
export const barBrandSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category:    { type: String, default: '' }, // e.g. 'whisky', 'vodka', 'wine', 'beer'
    isArchived:  { type: Boolean, default: false },
    createdAt:   { type: Date, default: Date.now },
    updatedAt:   { type: Date, default: Date.now },
  },
  { collection: 'bar_brands' }
)
barBrandSchema.index({ userId: 1, name: 1 }, { unique: true })
barBrandSchema.index({ userId: 1, branchId: 1, isArchived: 1 })

// ── BarInventoryItem ───────────────────────────────────────────────────────────
// A specific size/variant of a brand held in stock (e.g. Jameson 1L, Jameson 750ml)
export const barInventoryItemSchema = new mongoose.Schema(
  {
    userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    brandId:            { type: mongoose.Schema.Types.ObjectId, ref: 'BarBrand', required: true },
    // Human-readable name stored on import (e.g. 'Jameson').
    // Older records without this field fall back to the brand name at read time.
    name:               { type: String, default: '' },
    size:               { type: String, required: true },   // e.g. '1L', '750ml', '500ml'
    buyingPrice:        { type: Number, required: true },
    bottleSellingPrice: { type: Number, required: true },
    stock:              { type: Number, required: true, default: 0 },  // sealed bottles
    lowStockThreshold:  { type: Number, default: 3 },
    isActive:           { type: Boolean, default: true },
    createdAt:          { type: Date, default: Date.now },
    updatedAt:          { type: Date, default: Date.now },
  },
  { collection: 'bar_inventory_items' }
)
barInventoryItemSchema.index({ userId: 1, branchId: 1, brandId: 1 })
barInventoryItemSchema.index({ userId: 1, branchId: 1, stock: 1 })

// ── BarServing ─────────────────────────────────────────────────────────────────
// A configured serving portion for an inventory item (e.g. Tot, Double, Quarter)
// FRACTIONAL MODEL: servingsPerContainer defines how many servings a full container yields
// DEPRECATED: unitsProduced (kept for migration compatibility, will be removed in future)
export const barServingSchema = new mongoose.Schema(
  {
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'BarInventoryItem', required: true },
    name:            { type: String, required: true, trim: true },  // 'Tot', 'Double', 'Quarter'
    sellingPrice:    { type: Number, required: true },
    
    // NEW: Fractional model - how many servings does a full bottle yield?
    servingsPerContainer: { type: Number, required: true, min: 1 },  // e.g., 20 Tots per bottle
    
    // DEPRECATED: Old unit-based model (kept for migration reference)
    unitsProduced:   { type: Number, min: 1 },
    
    isActive:        { type: Boolean, default: true },
    createdAt:       { type: Date, default: Date.now },
    updatedAt:       { type: Date, default: Date.now },
  },
  { collection: 'bar_servings' }
)
barServingSchema.index({ userId: 1, inventoryItemId: 1 })
barServingSchema.index({ userId: 1, branchId: 1 })

// ── BarBottle ──────────────────────────────────────────────────────────────────
// Tracks the lifecycle of an individual physical bottle: full → open → closed
// FRACTIONAL MODEL: remainingFraction tracks bottle state as 0.0 (empty) to 1.0 (full)
// MULTI-BOTTLE SUPPORT: Multiple bottles can be open simultaneously
export const barBottleSchema = new mongoose.Schema(
  {
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'BarInventoryItem', required: true },
    bottleNumber:    { type: Number, required: true },  // sequential per inventory item
    state:           { type: String, enum: ['full', 'open', 'closed'], required: true },
    
    // NEW: Fractional state tracking (0.0 = empty, 1.0 = full)
    remainingFraction: { type: Number, default: 1.0, min: 0, max: 1 },
    expectedFraction:  { type: Number, default: 1.0 },  // Always 1.0 for new bottles
    actualFraction:    { type: Number },  // remainingFraction at close time
    varianceFraction:  { type: Number },  // Waste/loss tracking
    
    // DEPRECATED: Old unit-based tracking (kept for migration reference)
    expectedUnits:   { type: Number },
    remainingUnits:  { type: Number },
    actualUnitsSold: { type: Number },
    difference:      { type: Number },
    
    // Lifecycle tracking
    openedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    openedAt:        { type: Date },
    closedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    closedAt:        { type: Date },
    
    createdAt:       { type: Date, default: Date.now },
    updatedAt:       { type: Date, default: Date.now },
  },
  { collection: 'bar_bottles' }
)
// Regular compound index (no uniqueness - allows multiple open bottles)
barBottleSchema.index({ userId: 1, branchId: 1, inventoryItemId: 1, state: 1 })
barBottleSchema.index({ userId: 1, branchId: 1, inventoryItemId: 1, createdAt: -1 })
barBottleSchema.index({ userId: 1, branchId: 1, state: 1 })

// ── BarTab ─────────────────────────────────────────────────────────────────────
// Central tab document. Payments are embedded to support partial payments.

const barTabPaymentSchema = new mongoose.Schema(
  {
    amount:      { type: Number, required: true },
    method:      { type: String, enum: ['cash', 'card', 'mobile_money'], required: true },
    amountGiven: { type: Number },   // cash overpay tracking
    change:      { type: Number },
    mpesaCode:   { type: String },
    mpesaPhone:  { type: String },
    recordedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    recordedAt:  { type: Date, default: Date.now },
  },
  { _id: true }
)

export const barTabSchema = new mongoose.Schema(
  {
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    staffId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    tabNumber:      { type: String, required: true },
    customerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName:   { type: String, default: '' },
    tableNumber:    { type: String, default: '' },
    notes:          { type: String, default: '' },
    status:         { type: String, enum: ['open', 'hold', 'billing', 'paid'], default: 'open' },
    isSyntheticDirectSale: { type: Boolean, default: false },  // NEW: marks instant direct sales
    subtotal:       { type: Number, default: 0 },
    discountPct:    { type: Number, default: 0, min: 0, max: 100 },
    discountAmount: { type: Number, default: 0 },
    total:          { type: Number, default: 0 },
    amountPaid:     { type: Number, default: 0 },  // sum of payments
    payments:       { type: [barTabPaymentSchema], default: [] },
    saleId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },  // set on close
    openedAt:       { type: Date, default: Date.now },
    closedAt:       { type: Date },
    synced:         { type: Boolean, default: true },
    createdAt:      { type: Date, default: Date.now },
    updatedAt:      { type: Date, default: Date.now },
  },
  { collection: 'bar_tabs' }
)
barTabSchema.index({ userId: 1, branchId: 1, status: 1 })
barTabSchema.index({ userId: 1, branchId: 1, openedAt: -1 })
barTabSchema.index({ userId: 1, tabNumber: 1 }, { unique: true })

// ── BarTabLine ─────────────────────────────────────────────────────────────────
// Individual line items added to a tab.
// servingId is null for sealed bottle sales; populated for portion/serving sales.
// bottleId tracks which specific bottle supplied the serving (multi-bottle support)
export const barTabLineSchema = new mongoose.Schema(
  {
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    tabId:           { type: mongoose.Schema.Types.ObjectId, ref: 'BarTab', required: true },
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'BarInventoryItem', required: true },
    servingId:       { type: mongoose.Schema.Types.ObjectId, ref: 'BarServing' },  // null = bottle sale
    bottleId:        { type: mongoose.Schema.Types.ObjectId, ref: 'BarBottle' },   // NEW: which bottle was used
    itemName:        { type: String, required: true },   // denormalized for receipt display
    servingName:     { type: String, default: '' },      // denormalized for receipt display
    quantity:        { type: Number, required: true, min: 1 },
    unitPrice:       { type: Number, required: true },
    lineTotal:       { type: Number, required: true },
    addedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    addedAt:         { type: Date, default: Date.now },
    voided:          { type: Boolean, default: false },
    voidedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    voidedAt:        { type: Date },
  },
  { collection: 'bar_tab_lines' }
)
barTabLineSchema.index({ userId: 1, tabId: 1, addedAt: -1 })
barTabLineSchema.index({ userId: 1, inventoryItemId: 1, addedAt: -1 })
barTabLineSchema.index({ userId: 1, bottleId: 1 })  // NEW: bottle history lookups

// ── BarAuditLog ────────────────────────────────────────────────────────────────
// Immutable ledger of all significant bar operations.
// Records are never updated or deleted — only inserted.
export const barAuditLogSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    staffId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    operation: {
      type: String,
      enum: [
        'TAB_CREATED',
        'TAB_LINE_ADDED',
        'TAB_STATUS_CHANGED',
        'TAB_DISCOUNT_APPLIED',
        'TAB_CLOSED',
        'SERVING_SOLD',
        'BOTTLE_SOLD',
        'BOTTLE_OPENED',
        'BOTTLE_CLOSED',
        'INVENTORY_ADJUSTED',
      ],
      required: true,
    },
    referenceId:   { type: String },   // tabId, bottleId, etc.
    referenceType: { type: String },   // 'BarTab', 'BarBottle', etc.
    details:       { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp:     { type: Date, default: Date.now },
  },
  { collection: 'bar_audit_logs' }
)
barAuditLogSchema.index({ userId: 1, branchId: 1, timestamp: -1 })
barAuditLogSchema.index({ userId: 1, staffId: 1, timestamp: -1 })
barAuditLogSchema.index({ userId: 1, operation: 1, timestamp: -1 })
// No pre-save hooks — intentionally immutable

// ── BarBottleAudit ─────────────────────────────────────────────────────────────
// Variance tracking: expected vs actual servings when bottles are closed
// Used for theft detection, spillage analysis, and accountability
const barBottleAuditServingSchema = new mongoose.Schema(
  {
    servingId:   { type: mongoose.Schema.Types.ObjectId, ref: 'BarServing', required: true },
    servingName: { type: String, required: true },
    quantity:    { type: Number, required: true },
  },
  { _id: false }
)

export const barBottleAuditSchema = new mongoose.Schema(
  {
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    bottleId:        { type: mongoose.Schema.Types.ObjectId, ref: 'BarBottle', required: true },
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'BarInventoryItem', required: true },
    
    // Product context (denormalized for reporting)
    productName:     { type: String, required: true },
    productSize:     { type: String, default: '' },
    brandCategory:   { type: String, default: '' },
    
    // Bottle state at closure
    bottleNumber:       { type: Number, required: true },
    remainingFraction:  { type: Number, required: true, min: 0, max: 1 },  // at close time
    
    // Expected servings (calculated from remainingFraction)
    expectedServings:   { type: [barBottleAuditServingSchema], default: [] },
    totalExpected:      { type: Number, required: true },
    
    // Actual servings sold (from BarTabLine)
    actualServings:     { type: [barBottleAuditServingSchema], default: [] },
    totalActual:        { type: Number, required: true },
    
    // Variance analysis
    varianceQuantity:   { type: Number, required: true },  // expected - actual
    variancePercentage: { type: Number, required: true },  // (variance / expected) * 100
    varianceFlag:       { type: String, enum: ['normal', 'warning', 'critical'], required: true },
    
    // Audit context
    closedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    closedAt:        { type: Date, required: true },
    notes:           { type: String, default: '' },
    
    createdAt:       { type: Date, default: Date.now },
  },
  { collection: 'bar_bottle_audits' }
)
barBottleAuditSchema.index({ userId: 1, branchId: 1, closedAt: -1 })
barBottleAuditSchema.index({ userId: 1, bottleId: 1 })
barBottleAuditSchema.index({ userId: 1, inventoryItemId: 1, closedAt: -1 })
barBottleAuditSchema.index({ userId: 1, varianceFlag: 1, closedAt: -1 })  // high-variance queries
barBottleAuditSchema.index({ userId: 1, closedBy: 1, closedAt: -1 })      // per-staff analysis
// Immutable - no updates allowed after creation
