// ─── Model factory — binds all models to a specific tenant DB connection ───────
import type mongoose from 'mongoose'
import {
  productSchema, saleSchema, categorySchema, staffSchema, userSchema,
  rentalSchema, rentalServiceSchema, rentalBookingSchema,
  kitchenOrderSchema, menuItemSchema, expenseSchema, expenseCategorySchema,
  reportSchema, stockLedgerSchema,
  customerSchema, drugBatchSchema, drugSchema,
  branchSchema, inventorySchema, inventoryTransactionSchema,
  barBrandSchema, barInventoryItemSchema, barServingSchema, barBottleSchema,
  barTabSchema, barTabLineSchema, barAuditLogSchema, barBottleAuditSchema,
} from '@/lib/models/schemas'

export function getModels(conn: mongoose.Connection) {
  return {
    Product:         conn.models.Product         || conn.model('Product',         productSchema),
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
    Customer:        conn.models.Customer        || conn.model('Customer',        customerSchema),
    DrugBatch:       conn.models.DrugBatch       || conn.model('DrugBatch',       drugBatchSchema),
    Drug:            conn.models.Drug            || conn.model('Drug',            drugSchema),
    Branch:          conn.models.Branch          || conn.model('Branch',          branchSchema),
    Inventory:       conn.models.Inventory       || conn.model('Inventory',       inventorySchema),
    InventoryTransaction: conn.models.InventoryTransaction || conn.model('InventoryTransaction', inventoryTransactionSchema),
    BarBrand:         conn.models.BarBrand         || conn.model('BarBrand',         barBrandSchema),
    BarInventoryItem: conn.models.BarInventoryItem || conn.model('BarInventoryItem', barInventoryItemSchema),
    BarServing:       conn.models.BarServing       || conn.model('BarServing',       barServingSchema),
    BarBottle:        conn.models.BarBottle        || conn.model('BarBottle',        barBottleSchema),
    BarTab:           conn.models.BarTab           || conn.model('BarTab',           barTabSchema),
    BarTabLine:       conn.models.BarTabLine       || conn.model('BarTabLine',       barTabLineSchema),
    BarAuditLog:      conn.models.BarAuditLog      || conn.model('BarAuditLog',      barAuditLogSchema),
    BarBottleAudit:   conn.models.BarBottleAudit   || conn.model('BarBottleAudit',   barBottleAuditSchema),
  }
}
