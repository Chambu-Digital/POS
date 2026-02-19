import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    productCount: {
      type: Number,
      default: 0,
    },
    color: {
      type: String,
      default: '#3b82f6', // Default blue color
    },
    icon: {
      type: String,
      default: 'package',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'categories' }
)

// Compound index to ensure unique category names per user
categorySchema.index({ userId: 1, name: 1 }, { unique: true })

// Index for faster queries
categorySchema.index({ userId: 1, isActive: 1 })

// Update the updatedAt timestamp before saving
categorySchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

export default mongoose.models.Category ||
  mongoose.model('Category', categorySchema)

