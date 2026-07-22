/**
 * Payment Handler
 *
 * Manages payment recording and tab closure for the bar module.
 * Handles cash (with change calculation), card, and mobile_money (M-Pesa) payments.
 *
 * All methods are static and accept a mongoose.Connection, following the
 * per-tenant connection pattern used throughout the codebase.
 *
 * Flow:
 *   1. Tab is moved to 'billing' status (via TabManager.setStatus)
 *   2. recordPayment() is called one or more times until balance is covered
 *   3. closeTab() validates the balance is covered, creates a Sale record,
 *      writes saleId back to the BarTab, and marks the tab as 'paid'
 *
 * Error codes:
 *   TAB_NOT_IN_BILLING  — recordPayment/closeTab called when tab is not 'billing'
 *   BALANCE_OUTSTANDING — closeTab called when remaining balance > 0
 */

import type mongoose from 'mongoose'
import { getModels } from '@/lib/tenant/get-models'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaymentInput {
  amount: number
  method: 'cash' | 'card' | 'mobile_money'
  amountGiven?: number    // for cash payments (must be >= amount)
  mpesaCode?: string      // for mobile_money payments
  mpesaPhone?: string     // for mobile_money payments
  staffId: string
}

export interface RemainingBalance {
  total: number
  amountPaid: number
  remaining: number
}

// ── PaymentHandler ────────────────────────────────────────────────────────────

export class PaymentHandler {
  /**
   * Record a payment against a tab that is in 'billing' status.
   *
   * Validates the tab is in 'billing' status, then appends the payment
   * to tab.payments and recalculates tab.amountPaid.
   *
   * For cash: computes change = amountGiven - amount (stored on the payment).
   * For mobile_money: stores mpesaCode and mpesaPhone on the payment.
   * For card: no extra fields required.
   *
   * Inserts an immutable TAB_STATUS_CHANGED audit log entry.
   * Note: we reuse TAB_STATUS_CHANGED with operation context in details,
   * or we use TAB_LINE_ADDED — but since the audit schema only has specific ops
   * and "PAYMENT_RECORDED" isn't in it, we log it under TAB_CLOSED operation
   * for payment events. However, the design specifies the audit log for payments
   * as a TAB_STATUS_CHANGED or similar; per the schema the closest is TAB_CLOSED.
   * Since the schema does not have a PAYMENT_RECORDED operation we use
   * TAB_STATUS_CHANGED with details that describe the payment.
   *
   * @param tabId   - The BarTab _id
   * @param payment - Payment details
   * @param conn    - Tenant mongoose connection
   * @returns The updated BarTab document (plain object)
   * @throws Error('TAB_NOT_IN_BILLING') if tab is not in 'billing' status
   */
  static async recordPayment(
    tabId: string,
    payment: PaymentInput,
    conn: mongoose.Connection
  ): Promise<Record<string, unknown>> {
    const models = getModels(conn)

    const tab = await models.BarTab.findById(tabId)
    if (!tab) {
      throw new Error('TAB_NOT_FOUND')
    }

    if (tab.status !== 'billing') {
      throw new Error('TAB_NOT_IN_BILLING')
    }

    const now = new Date()

    // Build the payment subdocument
    const paymentDoc: Record<string, unknown> = {
      amount:     payment.amount,
      method:     payment.method,
      recordedBy: payment.staffId,
      recordedAt: now,
    }

    if (payment.method === 'cash') {
      const amountGiven = payment.amountGiven ?? payment.amount
      const change = amountGiven - payment.amount
      paymentDoc.amountGiven = amountGiven
      paymentDoc.change      = change >= 0 ? change : 0
    }

    if (payment.method === 'mobile_money') {
      if (payment.mpesaCode)  paymentDoc.mpesaCode  = payment.mpesaCode
      if (payment.mpesaPhone) paymentDoc.mpesaPhone = payment.mpesaPhone
    }

    // Append payment and recalculate amountPaid
    const payments = (tab.payments as Array<Record<string, unknown>>) ?? []
    payments.push(paymentDoc)
    tab.payments = payments

    const amountPaid = payments.reduce(
      (sum: number, p: Record<string, unknown>) => sum + ((p.amount as number) ?? 0),
      0
    )
    tab.amountPaid = amountPaid
    tab.updatedAt  = now
    await tab.save()

    // Immutable audit log — use TAB_STATUS_CHANGED operation with payment details
    // (no PAYMENT_RECORDED enum value exists in the schema)
    await models.BarAuditLog.create({
      userId:        tab.userId,
      branchId:      tab.branchId,
      staffId:       payment.staffId,
      operation:     'TAB_STATUS_CHANGED',
      referenceId:   String(tab._id),
      referenceType: 'BarTab',
      details: {
        event:       'PAYMENT_RECORDED',
        tabId:       String(tab._id),
        amount:      payment.amount,
        method:      payment.method,
        amountGiven: paymentDoc.amountGiven,
        change:      paymentDoc.change,
        mpesaCode:   paymentDoc.mpesaCode,
        mpesaPhone:  paymentDoc.mpesaPhone,
        amountPaid,
        remaining:   (tab.total as number) - amountPaid,
      },
      timestamp: now,
    })

    return tab.toObject()
  }

  /**
   * Get the remaining balance on a tab.
   *
   * Returns the tab's cached total minus amountPaid. This is a lightweight
   * read — it does not re-derive from line items, so it is suitable for
   * quick balance checks.
   *
   * @param tabId - The BarTab _id
   * @param conn  - Tenant mongoose connection
   * @returns { total, amountPaid, remaining }
   * @throws Error('TAB_NOT_FOUND') if the tab does not exist
   */
  static async getRemainingBalance(
    tabId: string,
    conn: mongoose.Connection
  ): Promise<RemainingBalance> {
    const models = getModels(conn)

    const tab = await models.BarTab.findById(tabId)
    if (!tab) {
      throw new Error('TAB_NOT_FOUND')
    }

    const total      = (tab.total      as number) ?? 0
    const amountPaid = (tab.amountPaid as number) ?? 0
    const remaining  = total - amountPaid

    return { total, amountPaid, remaining }
  }

  /**
   * Close a tab: validate it is fully paid, create a Sale record, update the tab.
   *
   * Prerequisites:
   *   - Tab must be in 'billing' status (throws TAB_NOT_IN_BILLING otherwise)
   *   - remaining balance must be <= 0 (throws BALANCE_OUTSTANDING otherwise)
   *
   * On Sale save success:
   *   - Sets tab.saleId to the new Sale _id
   *   - Sets tab.status to 'paid'
   *   - Sets tab.closedAt to now
   *   - Sets tab.synced to true
   *   - Inserts TAB_CLOSED audit log
   *
   * On Sale save failure:
   *   - Does NOT change tab.status (remains 'billing')
   *   - Sets tab.synced to false
   *   - Inserts TAB_CLOSED audit log with details.syncFailed = true
   *
   * @param tabId - The BarTab _id
   * @param conn  - Tenant mongoose connection
   * @returns { tab, sale } where sale may be null if Sale creation failed
   * @throws Error('TAB_NOT_IN_BILLING') if tab is not in 'billing' status
   * @throws Error('BALANCE_OUTSTANDING') if remaining balance > 0
   */
  static async closeTab(
    tabId: string,
    conn: mongoose.Connection
  ): Promise<{ tab: Record<string, unknown>; sale: Record<string, unknown> | null }> {
    const models = getModels(conn)

    const tab = await models.BarTab.findById(tabId)
    if (!tab) {
      throw new Error('TAB_NOT_FOUND')
    }

    if (tab.status !== 'billing') {
      throw new Error('TAB_NOT_IN_BILLING')
    }

    const total      = (tab.total      as number) ?? 0
    const amountPaid = (tab.amountPaid as number) ?? 0
    const remaining  = total - amountPaid

    if (remaining > 0) {
      throw new Error('BALANCE_OUTSTANDING')
    }

    // Fetch all non-voided tab lines for the Sale items array
    const tabLines = await models.BarTabLine.find({ tabId, voided: false })

    // Resolve the owner (userId on the tab is the owner ObjectId)
    const ownerId = tab.userId

    // Build Sale items from tab lines
    const saleItems = (tabLines as Array<Record<string, unknown>>).map((line) => ({
      productId:   line.inventoryItemId,
      productName: line.servingName
        ? `${line.itemName} (${line.servingName})`
        : line.itemName,
      quantity:    line.quantity,
      price:       line.unitPrice,
      discount:    0,
    }))

    // Resolve payment method and M-Pesa details from the last payment
    const payments = (tab.payments as Array<Record<string, unknown>>) ?? []
    const lastPayment = payments[payments.length - 1] as Record<string, unknown> | undefined
    const paymentMethod = (lastPayment?.method as string) ?? 'cash'
    const mpesaCode  = (payments.find((p) => p.mpesaCode)  as Record<string, unknown> | undefined)?.mpesaCode  as string | undefined
    const mpesaPhone = (payments.find((p) => p.mpesaPhone) as Record<string, unknown> | undefined)?.mpesaPhone as string | undefined

    // Build the Sale document (not yet saved)
    const sale = new models.Sale({
      userId:        ownerId,
      staffId:       tab.staffId,
      orderNumber:   tab.tabNumber,
      customerId:    tab.customerId,
      customerName:  tab.customerName,
      items:         saleItems,
      subtotal:      tab.subtotal,
      discount:      tab.discountAmount,
      total:         tab.total,
      amountPaid:    tab.amountPaid,
      paymentMethod,
      mpesaCode,
      mpesaPhone,
      notes:         tab.notes,
      source:        'bar',
      status:        'completed',
      synced:        true,
    })

    const now = new Date()

    let savedSale: Record<string, unknown> | null = null
    let syncFailed = false

    try {
      await sale.save()
      savedSale = sale.toObject()
    } catch {
      syncFailed = true
    }

    if (!syncFailed) {
      // Sale saved successfully — mark tab as paid
      tab.saleId   = sale._id
      tab.status   = 'paid'
      tab.closedAt = now
      tab.synced   = true
      tab.updatedAt = now
      await tab.save()

      // Immutable audit log
      await models.BarAuditLog.create({
        userId:        tab.userId,
        branchId:      tab.branchId,
        staffId:       (lastPayment?.recordedBy as string) ?? String(tab.staffId ?? tab.userId),
        operation:     'TAB_CLOSED',
        referenceId:   String(tab._id),
        referenceType: 'BarTab',
        details: {
          tabId:       String(tab._id),
          tabNumber:   tab.tabNumber,
          saleId:      String(sale._id),
          total:       tab.total,
          amountPaid:  tab.amountPaid,
          syncFailed:  false,
        },
        timestamp: now,
      })
    } else {
      // Sale save failed — mark as unsynced but keep in billing
      tab.synced    = false
      tab.updatedAt = now
      await tab.save()

      // Immutable audit log with syncFailed flag
      await models.BarAuditLog.create({
        userId:        tab.userId,
        branchId:      tab.branchId,
        staffId:       (lastPayment?.recordedBy as string) ?? String(tab.staffId ?? tab.userId),
        operation:     'TAB_CLOSED',
        referenceId:   String(tab._id),
        referenceType: 'BarTab',
        details: {
          tabId:       String(tab._id),
          tabNumber:   tab.tabNumber,
          saleId:      null,
          total:       tab.total,
          amountPaid:  tab.amountPaid,
          syncFailed:  true,
        },
        timestamp: now,
      })
    }

    return {
      tab:  tab.toObject(),
      sale: savedSale,
    }
  }
}
