import mongoose from 'mongoose'

const kitchenOrderItemSchema = new mongoose.Schema({
  itemId:   { type: String, required: true },
  name:     { type: String, required: true },
  quantity: { type: Number, required: true },
  notes:    { type: String },
  category: { type: String, required: true },
  prepTime: { type: Number, required: true },
}, { _id: false })

const kitchenOrderSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderNumber: { type: String, required: true },
    tableNumber: { type: String, required: true },
    waiterName:  { type: String, required: true },
    waiterId:    { type: String },
    coverCount:  { type: Number, default: 1 },
    items:       { type: [kitchenOrderItemSchema], required: true },
    status: {
      type: String,
      enum: ['pending', 'acknowledged', 'preparing', 'ready', 'collected'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['normal', 'rush', 'vip'],
      default: 'normal',
    },
    specialInstructions: { type: String },
    acknowledgedAt: { type: Date },
    preparingAt:    { type: Date },
    readyAt:        { type: Date },
    collectedAt:    { type: Date },
    // Total bill for this order (set when collected)
    totalAmount:    { type: Number, default: 0 },
  },
  {
    timestamps: true,   // createdAt + updatedAt
    collection: 'kitchen_orders',
  }
)

kitchenOrderSchema.index({ userId: 1, createdAt: -1 })
kitchenOrderSchema.index({ userId: 1, status: 1 })
kitchenOrderSchema.index({ userId: 1, tableNumber: 1, status: 1 })

export default mongoose.models.KitchenOrder ||
  mongoose.model('KitchenOrder', kitchenOrderSchema)
