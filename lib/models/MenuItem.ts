import mongoose from 'mongoose'

const MenuItemSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  category: { 
    type: String, 
    required: true,
    enum: ['starter', 'main', 'side', 'dessert', 'drink'],
    default: 'main'
  },
  price: { type: Number, required: true, min: 0 },
  prepTime: { type: Number, default: 15 }, // minutes
  station: {
    type: String,
    enum: ['grill', 'drinks', 'dessert', 'pizza', 'all'],
    default: 'all'
  },
  available: { type: Boolean, default: true },
  popular: { type: Boolean, default: false },
  image: { type: String, default: '' },
  // Link to inventory product for stock tracking
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  // Ingredients for recipe costing
  ingredients: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: 'unit' }
  }],
  allergens: [{ type: String }],
  spicyLevel: { type: Number, min: 0, max: 5, default: 0 },
  vegetarian: { type: Boolean, default: false },
  vegan: { type: Boolean, default: false },
  glutenFree: { type: Boolean, default: false },
}, {
  timestamps: true,
})

MenuItemSchema.index({ userId: 1, category: 1 })
MenuItemSchema.index({ userId: 1, available: 1 })

export const MenuItem = mongoose.models.MenuItem || mongoose.model('MenuItem', MenuItemSchema)
