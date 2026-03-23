import mongoose from 'mongoose'

const rentalBookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalService', required: true },
    serviceName: { type: String, required: true },
    serviceCategory: { type: String, required: true },
    // Selected pricing tier
    pricingLabel: { type: String, required: true },
    pricingDuration: { type: Number, required: true }, // minutes
    pricingRate: { type: Number, required: true },
    // Actual times
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    // Customer
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      idNo: { type: String },
    },
    guestCount: { type: Number, default: 1 },
    notes: { type: String },
    // Financials
    deposit: { type: Number, default: 0 },
    depositPaymentMethod: { type: String },
    totalAmount: { type: Number },
    paymentMethod: { type: String, enum: ['cash', 'card', 'mobile_money'] },
    mpesaCode: { type: String },
    mpesaPhone: { type: String },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled', 'overdue'],
      default: 'active',
    },
  },
  { collection: 'rental_bookings', timestamps: true }
)

rentalBookingSchema.index({ userId: 1, createdAt: -1 })
rentalBookingSchema.index({ userId: 1, status: 1 })

if (mongoose.models.RentalBooking) delete mongoose.models.RentalBooking
export default mongoose.model('RentalBooking', rentalBookingSchema)
