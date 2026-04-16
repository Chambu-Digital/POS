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
    paymentMethod: { type: String, enum: ['cash', 'card', 'mobile_money'], required: true },
    mpesaCode:     String,
    mpesaPhone:    String,
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
      canMakeSales:        { type: Boolean, default: true },
      canViewOrders:       { type: Boolean, default: true },
      canViewInventory:    { type: Boolean, default: true },
      canEditInventory:    { type: Boolean, default: false },
      canAddProducts:      { type: Boolean, default: false },
      canDeleteProducts:   { type: Boolean, default: false },
      canViewSalesReports: { type: Boolean, default: false },
      canViewDashboard:    { type: Boolean, default: true },
      canManageStaff:      { type: Boolean, default: false },
      canEditSettings:     { type: Boolean, default: false },
      canProcessRefunds:   { type: Boolean, default: false },
      canApplyDiscounts:   { type: Boolean, default: true },
      canDeleteOrders:     { type: Boolean, default: false },
      canExportData:       { type: Boolean, default: false },
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
    itemId:   { type: String, required: true },
    name:     { type: String, required: true },
    quantity: { type: Number, required: true },
    notes:    String,
    category: { type: String, required: true },
    prepTime: { type: Number, required: true },
  },
  { _id: false }
)

export const kitchenOrderSchema = new mongoose.Schema(
  {
    userId:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderNumber:         { type: String, required: true },
    tableNumber:         { type: String, required: true },
    waiterName:          { type: String, required: true },
    waiterId:            String,
    coverCount:          { type: Number, default: 1 },
    items:               { type: [kitchenOrderItemSchema], required: true },
    status:              { type: String, enum: ['pending', 'acknowledged', 'preparing', 'ready', 'collected'], default: 'pending' },
    priority:            { type: String, enum: ['normal', 'rush', 'vip'], default: 'normal' },
    specialInstructions: String,
    acknowledgedAt:      Date,
    preparingAt:         Date,
    readyAt:             Date,
    collectedAt:         Date,
    totalAmount:         { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'kitchen_orders' }
)
kitchenOrderSchema.index({ userId: 1, createdAt: -1 })
kitchenOrderSchema.index({ userId: 1, status: 1 })
kitchenOrderSchema.index({ userId: 1, tableNumber: 1, status: 1 })

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
