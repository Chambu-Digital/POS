import mongoose from 'mongoose'

const saleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: false, // optional — rental orders have no product
        },
        productName: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        discount: {
          type: Number,
          default: 0,
        },
      },
    ],
    subtotal: Number,
    discount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'mobile_money'],
      required: true,
    },
    mpesaCode: {
      type: String,
    },
    mpesaPhone: {
      type: String,
    },
    notes: String,
    source: {
      type: String,
      enum: ['pos', 'bar', 'kds', 'rental'],
      default: 'pos',
    },
    // Extra metadata for rental orders
    rentalMeta: {
      bookingId: { type: mongoose.Schema.Types.ObjectId },
      serviceName: String,
      serviceCategory: String,
      pricingLabel: String,
      startTime: Date,
      endTime: Date,
      guestCount: Number,
      deposit: Number,
      customerName: String,
      customerPhone: String,
      customerIdNo: String,
    },
    status: {
      type: String,
      enum: ['completed', 'pending', 'held', 'refunded'],
      default: 'completed',
    },
    synced: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'sales' }
)

saleSchema.index({ userId: 1, createdAt: -1 })

export default mongoose.models.Sale ||
  mongoose.model('Sale', saleSchema)
