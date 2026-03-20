import mongoose from 'mongoose'

const rentalSchema = new mongoose.Schema(
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
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      idNo: { type: String },
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        productName: { type: String, required: true },
        quantity: { type: Number, required: true },
        rentalRate: { type: Number, required: true },
        rateType: {
          type: String,
          enum: ['per_minute', 'hourly', 'daily', 'weekly'],
          required: true,
        },
      },
    ],
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number }, // in minutes, set on return
    deposit: { type: Number, default: 0 },
    depositPaymentMethod: { type: String },
    totalAmount: { type: Number }, // set on return
    paymentMethod: { type: String, enum: ['cash', 'card', 'mobile_money'] },
    mpesaCode: String,
    mpesaPhone: String,
    status: {
      type: String,
      enum: ['active', 'returned', 'overdue'],
      default: 'active',
    },
    notes: String,
  },
  { collection: 'rentals', timestamps: true }
)

rentalSchema.index({ userId: 1, createdAt: -1 })
rentalSchema.index({ userId: 1, status: 1 })

// Clear cached model to pick up schema changes
if (mongoose.models.Rental) delete mongoose.models.Rental

export default mongoose.model('Rental', rentalSchema)
