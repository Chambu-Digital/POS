import mongoose from 'mongoose'

const productSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    variant: String,
    brand: String,
    model: String,
    unit: String,
    buyingPrice: {
      type: Number,
      required: true,
    },
    sellingPrice: {
      type: Number,
      required: true,
    },
    wholeSale: {
      type: Number,
      default: 0,
    },
    description: String,
    stock: {
      type: Number,
      required: true,
      default: 0,
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
  { collection: 'products' }
)

// Index for faster queries
productSchema.index({ userId: 1, productName: 1 })
productSchema.index({ userId: 1, category: 1 })

export default mongoose.models.Product ||
  mongoose.model('Product', productSchema)
