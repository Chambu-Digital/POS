import mongoose from 'mongoose'

const expenseCategorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
  },
  { collection: 'expense_categories' }
)
expenseCategorySchema.index({ userId: 1, name: 1 }, { unique: true })

const expenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    notes: { type: String, default: '' },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'expenses' }
)
expenseSchema.index({ userId: 1, createdAt: -1 })

export const ExpenseCategory =
  mongoose.models.ExpenseCategory ||
  mongoose.model('ExpenseCategory', expenseCategorySchema)

export default mongoose.models.Expense || mongoose.model('Expense', expenseSchema)
