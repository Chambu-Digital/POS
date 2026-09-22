// ─── Model factory — binds all models to a specific tenant DB connection ───────
import type mongoose from 'mongoose'
import {
  productSchema, productInventorySchema, saleSchema, categorySchema, staffSchema, userSchema,
  rentalSchema, rentalServiceSchema, rentalBookingSchema,
  kitchenOrderSchema, menuItemSchema, expenseSchema, expenseCategorySchema,
  reportSchema, stockLedgerSchema, supplierSchema,
  customerSchema, drugBatchSchema, drugSchema,
  branchSchema, inventorySchema, inventoryTransactionSchema,

  purchaseOrderSchema, restockPlanSchema,
  hospitalityMenuItemSchema, hospitalityServingTypeSchema, hospitalityServingInventorySchema,
  hospitalityServingMovementSchema, hospitalityProductionLogSchema, hospitalityOrderSchema,
  hospitalityCategorySchema,
  stockTransferSchema, notificationSchema,
} from '@/lib/models/schemas'

export function getModels(conn: mongoose.Connection) {
  return {
    Product:         conn.models.Product         || conn.model('Product',         productSchema),
    ProductInventory: conn.models.ProductInventory || conn.model('ProductInventory', productInventorySchema),
    Sale:            conn.models.Sale            || conn.model('Sale',            saleSchema),
    Category:        conn.models.Category        || conn.model('Category',        categorySchema),
    Staff:           conn.models.Staff           || conn.model('Staff',           staffSchema),
    User:            conn.models.User            || conn.model('User',            userSchema),
    Rental:          conn.models.Rental          || conn.model('Rental',          rentalSchema),
    RentalService:   conn.models.RentalService   || conn.model('RentalService',   rentalServiceSchema),
    RentalBooking:   conn.models.RentalBooking   || conn.model('RentalBooking',   rentalBookingSchema),
    KitchenOrder:    conn.models.KitchenOrder    || conn.model('KitchenOrder',    kitchenOrderSchema),
    MenuItem:        conn.models.MenuItem        || conn.model('MenuItem',        menuItemSchema),
    Expense:         conn.models.Expense         || conn.model('Expense',         expenseSchema),
    ExpenseCategory: conn.models.ExpenseCategory || conn.model('ExpenseCategory', expenseCategorySchema),
    Report:          conn.models.Report          || conn.model('Report',          reportSchema),
    StockLedger:     conn.models.StockLedger     || conn.model('StockLedger',     stockLedgerSchema),
    Supplier:        conn.models.Supplier        || conn.model('Supplier',        supplierSchema),
    Customer:        conn.models.Customer        || conn.model('Customer',        customerSchema),
    DrugBatch:       conn.models.DrugBatch       || conn.model('DrugBatch',       drugBatchSchema),
    Drug:            conn.models.Drug            || conn.model('Drug',            drugSchema),
    Branch:          conn.models.Branch          || conn.model('Branch',          branchSchema),
    Inventory:       conn.models.Inventory       || conn.model('Inventory',       inventorySchema),
    InventoryTransaction: conn.models.InventoryTransaction || conn.model('InventoryTransaction', inventoryTransactionSchema),

    PurchaseOrder:    conn.models.PurchaseOrder    || conn.model('PurchaseOrder',    purchaseOrderSchema),
    RestockPlan:      conn.models.RestockPlan      || conn.model('RestockPlan',      restockPlanSchema),
    HospitalityMenuItem:        conn.models.HospitalityMenuItem        || conn.model('HospitalityMenuItem',        hospitalityMenuItemSchema),
    HospitalityServingType:     conn.models.HospitalityServingType     || conn.model('HospitalityServingType',     hospitalityServingTypeSchema),
    HospitalityServingInventory: conn.models.HospitalityServingInventory || conn.model('HospitalityServingInventory', hospitalityServingInventorySchema),
    HospitalityServingMovement: conn.models.HospitalityServingMovement || conn.model('HospitalityServingMovement', hospitalityServingMovementSchema),
    HospitalityProductionLog:   conn.models.HospitalityProductionLog   || conn.model('HospitalityProductionLog',   hospitalityProductionLogSchema),
    HospitalityOrder:           conn.models.HospitalityOrder           || conn.model('HospitalityOrder',           hospitalityOrderSchema),
    HospitalityCategory:        conn.models.HospitalityCategory        || conn.model('HospitalityCategory',        hospitalityCategorySchema),
    StockTransfer:              conn.models.StockTransfer              || conn.model('StockTransfer',              stockTransferSchema),
    Notification:               conn.models.Notification               || conn.model('Notification',               notificationSchema),
  }
}
