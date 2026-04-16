// ─── Model factory — binds all models to a specific tenant DB connection ───────
import type mongoose from 'mongoose'
import {
  productSchema, saleSchema, categorySchema, staffSchema, userSchema,
  rentalSchema, rentalServiceSchema, rentalBookingSchema,
  kitchenOrderSchema, expenseSchema, expenseCategorySchema, reportSchema,
} from '@/lib/models/schemas'

export function getModels(conn: mongoose.Connection) {
  // conn.models.X || conn.model(...) prevents "model already registered" errors
  // when the same connection is reused across requests
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
    Expense:         conn.models.Expense         || conn.model('Expense',         expenseSchema),
    ExpenseCategory: conn.models.ExpenseCategory || conn.model('ExpenseCategory', expenseCategorySchema),
    Report:          conn.models.Report          || conn.model('Report',          reportSchema),
  }
}
