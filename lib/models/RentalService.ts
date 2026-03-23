import mongoose from 'mongoose'

const rentalServiceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ['room', 'bike', 'car', 'airbnb', 'other'],
      required: true,
    },
    description: { type: String },
    // Pricing tiers — at least one required
    pricing: [
      {
        label: { type: String, required: true }, // e.g. "Per Hour", "Overnight", "Weekly"
        duration: { type: Number, required: true }, // in minutes
        price: { type: Number, required: true },
      },
    ],
    // Optional extras / amenities
    amenities: [{ type: String }],
    capacity: { type: Number }, // max guests / riders
    isActive: { type: Boolean, default: true },
    imageUrl: { type: String },
  },
  { collection: 'rental_services', timestamps: true }
)

rentalServiceSchema.index({ userId: 1, category: 1 })

if (mongoose.models.RentalService) delete mongoose.models.RentalService
export default mongoose.model('RentalService', rentalServiceSchema)
