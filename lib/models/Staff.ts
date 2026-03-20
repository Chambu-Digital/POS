import mongoose from 'mongoose'
import bcryptjs from 'bcryptjs'

const staffSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
    },
    jobDescription: {
      type: String,
      default: '',
    },
    // Extended employee details
    firstName: { type: String, default: '' },
    middleName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    nationalId: { type: String, default: '' },
    kraPin: { type: String, default: '' },
    nhifNo: { type: String, default: '' },
    nssfNo: { type: String, default: '' },
    leaveDays: { type: Number, default: 14 },
    salary: { type: Number, default: 0 },
    commissionStructure: { type: String, default: '' },
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'intern', ''],
      default: '',
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['cashier', 'manager', 'supervisor', 'employee'],
      required: true,
    },
    permissions: {
      canMakeSales: { type: Boolean, default: true },
      canViewOrders: { type: Boolean, default: true },
      canViewInventory: { type: Boolean, default: true },
      canEditInventory: { type: Boolean, default: false },
      canAddProducts: { type: Boolean, default: false },
      canDeleteProducts: { type: Boolean, default: false },
      canViewSalesReports: { type: Boolean, default: false },
      canViewDashboard: { type: Boolean, default: true },
      canManageStaff: { type: Boolean, default: false },
      canEditSettings: { type: Boolean, default: false },
      canProcessRefunds: { type: Boolean, default: false },
      canApplyDiscounts: { type: Boolean, default: true },
      canDeleteOrders: { type: Boolean, default: false },
      canExportData: { type: Boolean, default: false },
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'staff' }
)

staffSchema.index({ userId: 1, email: 1 })

// Hash password before saving
staffSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  try {
    const salt = await bcryptjs.genSalt(10)
    this.password = await bcryptjs.hash(this.password, salt)
    next()
  } catch (error) {
    next(error as Error)
  }
})

// Method to compare passwords
staffSchema.methods.comparePassword = async function (password: string) {
  return await bcryptjs.compare(password, this.password)
}

export default mongoose.models.Staff ||
  mongoose.model('Staff', staffSchema)
