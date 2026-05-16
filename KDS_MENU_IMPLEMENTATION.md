# Restaurant Menu & Inventory Integration

## ✅ What's Been Added

### 1. Menu Management System
- **New Page**: `/dashboard/kds/menu` (Owner/Admin only)
- **Features**:
  - Create, edit, delete menu items
  - Organize by categories (Starter, Main, Side, Dessert, Drink)
  - Set prices, prep times, and kitchen stations
  - Mark items as available/unavailable
  - Flag popular items
  - Dietary information (Vegetarian, Vegan, Gluten-Free)
  - Spicy level indicator (0-5)
  - Link menu items to inventory products for stock tracking

### 2. Database Model
- **New Model**: `MenuItem` in MongoDB
- **Fields**:
  - Basic: name, description, category, price
  - Kitchen: prepTime, station (grill/drinks/dessert/pizza)
  - Status: available, popular
  - Dietary: vegetarian, vegan, glutenFree, spicyLevel
  - Inventory: productId (links to Product model)
  - Ingredients: array for recipe costing

### 3. API Endpoints
- **GET** `/api/kds/menu` - Fetch menu items
  - Query params: `category`, `available`
  - Returns items with linked product stock info
- **POST** `/api/kds/menu` - Create menu item
- **PATCH** `/api/kds/menu` - Update menu item
- **DELETE** `/api/kds/menu?id=xxx` - Delete menu item

### 4. Integration with Create Order
- Waiters now select from restaurant menu (not inventory)
- Menu items show:
  - Name, description, price
  - Category badge
  - Prep time estimate
  - Stock status (if linked to inventory)
- Out-of-stock items automatically hidden

## 🎯 How It Works

### For Restaurant Owners:
1. Go to **Kitchen Display → Menu Management**
2. Click **"+ Add Menu Item"**
3. Fill in details:
   - Name & description
   - Category & kitchen station
   - Price & prep time
   - Link to inventory product (optional)
   - Dietary flags
4. Save and item appears in waiter's order menu

### For Waiters:
1. Go to **Kitchen Display → Create Order**
2. Click **"New Order"** button
3. Enter table details
4. Select items from restaurant menu
5. Add special notes per item
6. Send to kitchen

### Stock Tracking:
- Link menu items to inventory products
- System shows stock levels
- Can auto-hide out-of-stock items
- Future: Auto-deduct ingredients on order

## 📊 Menu Management Features

### Categories
- **Starter**: Appetizers, soups, salads
- **Main**: Main courses, entrees
- **Side**: Side dishes, accompaniments
- **Dessert**: Sweets, desserts
- **Drink**: Beverages, cocktails

### Kitchen Stations
- **Grill**: Grilled items, BBQ
- **Drinks**: Bar, beverages
- **Dessert**: Pastry station
- **Pizza**: Pizza oven
- **All**: General kitchen

### Dietary Flags
- 🥬 Vegetarian
- 🌱 Vegan
- 🌾 Gluten-Free
- 🌶️ Spicy Level (1-5)

### Item Status
- ✅ Available / ❌ Unavailable
- ⭐ Popular (featured items)
- 📦 Linked to Stock

## 🔗 Inventory Integration

### Linking Menu to Inventory:
1. Create product in **Inventory**
2. In **Menu Management**, select product when creating menu item
3. System tracks stock levels
4. Shows "Out of Stock" when inventory depleted

### Benefits:
- Real-time stock visibility
- Prevent ordering unavailable items
- Track ingredient usage
- Recipe costing (future feature)

## 📱 UI Updates

### Sidebar Structure:
```
Kitchen Display ▾
  ├─ Menu Management (Owner only)
  ├─ Create Order (Waiter)
  ├─ Chef View
  ├─ Waiter View
  └─ Order History
```

### Menu Management Page:
- Grid view of all menu items
- Category filters
- Search functionality
- Quick availability toggle
- Stats dashboard (total, available, popular, linked)

### Create Order Page:
- Clean menu selection interface
- Category-based browsing
- Search menu items
- Real-time cart with notes
- Stock status indicators

## 🚀 Next Steps (Optional)

### Advanced Features:
- [ ] Recipe management (ingredients per dish)
- [ ] Auto-deduct ingredients on order
- [ ] Cost calculation per dish
- [ ] Profit margin tracking
- [ ] Menu item images
- [ ] Combo meals / meal deals
- [ ] Modifiers (add-ons, extras)
- [ ] Portion sizes
- [ ] Seasonal menu items
- [ ] Menu analytics (best sellers)

### Inventory Enhancements:
- [ ] Low stock alerts for menu items
- [ ] Automatic reorder points
- [ ] Supplier management
- [ ] Ingredient waste tracking
- [ ] Recipe yield calculations

## 📝 Usage Guide

### Setting Up Your Menu:
1. **Add Inventory Products** (if not done)
   - Go to Inventory
   - Add all ingredients/products

2. **Create Menu Items**
   - Go to Menu Management
   - Add each dish with details
   - Link to inventory products
   - Set dietary flags

3. **Test Order Flow**
   - Go to Create Order
   - Create test order
   - Verify items appear correctly
   - Check chef/waiter views

### Best Practices:
- Keep descriptions concise
- Set realistic prep times
- Update availability daily
- Link high-value items to inventory
- Mark bestsellers as popular
- Use dietary flags for customer info

## 🐛 Troubleshooting

### Menu items not showing in Create Order:
- Check item is marked "Available"
- Verify category is set correctly
- Check if linked product is in stock

### Stock not updating:
- Ensure menu item is linked to product
- Check product exists in inventory
- Verify product has stock > 0

### Permission issues:
- Menu Management: Owner/Admin only
- Create Order: All staff with permission
- Ensure KDS features are enabled in settings

---

**Status**: ✅ Fully Implemented
**Database**: MongoDB with MenuItem model
**Integration**: Complete with Inventory & KDS
