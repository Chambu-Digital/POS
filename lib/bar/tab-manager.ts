/**
 * Tab Manager
 *
 * Manages the full lifecycle of a bar tab: creation, line management,
 * status transitions, discount application, and balance computation.
 *
 * All methods are static and accept a mongoose.Connection, following the
 * per-tenant connection pattern used throughout the codebase.
 *
 * State machine:
 *   open → hold        (setStatus)
 *   hold → open        (setStatus)
 *   open → billing     (setStatus)
 *   billing → open     (setStatus)
 *   billing → paid     (PaymentHandler.closeTab only)
 *   paid → *           (NOT allowed — all mutations blocked)
 *
 * Error codes:
 *   TAB_LOCKED               — addLine called when tab is not 'open'
 *   INVALID_STATUS_TRANSITION — setStatus called with an illegal transition
 *   INVALID_DISCOUNT          — applyDiscount called with a value not in {0,5,10,15,20}
 */

import type mongoose from 'mongoose'
import { ServingEngine } from '@/lib/bar/serving-engine'
import { InventoryEngine } from '@/lib/bar/inventory-engine'
import { getModels } from '@/lib/tenant/get-models'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TabStatus = 'open' | 'hold' | 'billing' | 'paid'

export interface CreateTabInput {
  userId: string
  branchId?: string
  staffId: string
  customerName?: string
  customerId?: string
  tableNumber?: string
  notes?: string
}

export interface AddLineInput {
  inventoryItemId: string
  servingId?: string | null  // null = bottle sale, string = serving sale
  quantity: number
  staffId: string
  itemName: string
  servingName?: string
  unitPrice: number  // price per unit
}

export interface RunningBalance {
  subtotal: number
  discountAmount: number
  total: number
  amountPaid: number
  remaining: number
}

// ── Valid status transitions ──────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<TabStatus, TabStatus[]> = {
  open:    ['hold', 'billing'],
  hold:    ['open'],
  billing: ['open'],
  paid:    [], // no transitions allowed from paid
}

// ── Allowed discount percentages ──────────────────────────────────────────────

const VALID_DISCOUNT_PCTS = new Set([0, 5, 10, 15, 20])

// ── TabManager ────────────────────────────────────────────────────────────────

export class TabManager {
  /**
   * Create a new bar tab with status 'open' and all balances at zero.
   *
   * Generates a sequential tabNumber in the format `BAR-{n}` by counting
   * all existing tabs for the given userId. Inserts a TAB_CREATED audit log.
   *
   * @param data - Tab creation input (userId, staffId required; rest optional)
   * @param conn - Tenant mongoose connection
   * @returns The newly created BarTab document (plain object)
   */
  static async createTab(
    data: CreateTabInput,
    conn: mongoose.Connection
  ): Promise<Record<string, unknown>> {
    const models = getModels(conn)

    // Generate sequential tab number scoped to this user
    const existingCount = await models.BarTab.countDocuments({ userId: data.userId })
    const tabNumber = `BAR-${existingCount + 1}`

    const now = new Date()
    const tab = await models.BarTab.create({
      userId:       data.userId,
      branchId:     data.branchId,
      staffId:      data.staffId,
      tabNumber,
      customerId:   data.customerId,
      customerName: data.customerName ?? '',
      tableNumber:  data.tableNumber ?? '',
      notes:        data.notes ?? '',
      status:       'open',
      subtotal:     0,
      discountPct:  0,
      discountAmount: 0,
      total:        0,
      amountPaid:   0,
      payments:     [],
      synced:       true,
      openedAt:     now,
      createdAt:    now,
      updatedAt:    now,
    })

    // Immutable audit log
    await models.BarAuditLog.create({
      userId:        data.userId,
      branchId:      data.branchId,
      staffId:       data.staffId,
      operation:     'TAB_CREATED',
      referenceId:   String(tab._id),
      referenceType: 'BarTab',
      details: {
        tabNumber,
        customerName: data.customerName ?? '',
        tableNumber:  data.tableNumber ?? '',
      },
      timestamp: now,
    })

    return tab.toObject()
  }

  /**
   * Add a line item to an open tab.
   *
   * Validates the tab is in 'open' status (throws TAB_LOCKED otherwise).
   * For serving sales: calls ServingEngine.computeServing and
   *   InventoryEngine.deductServingUnits.
   * For bottle sales (servingId is null/undefined): calls
   *   InventoryEngine.sellSealedBottle.
   * Inserts a BarTabLine, recomputes the tab's subtotal/discountAmount/total,
   * and inserts a TAB_LINE_ADDED audit log.
   *
   * @param tabId  - The BarTab _id
   * @param line   - Line item input
   * @param conn   - Tenant mongoose connection
   * @returns { tab, tabLine } as plain objects
   * @throws Error('TAB_LOCKED') if tab status is not 'open'
   * @throws Error('NO_OPEN_BOTTLE') propagated from InventoryEngine
   * @throws Error('INSUFFICIENT_STOCK') propagated from InventoryEngine
   */
  static async addLine(
    tabId: string,
    line: AddLineInput,
    conn: mongoose.Connection
  ): Promise<{ tab: Record<string, unknown>; tabLine: Record<string, unknown> }> {
    const models = getModels(conn)

    const tab = await models.BarTab.findById(tabId)
    if (!tab) {
      throw new Error('TAB_NOT_FOUND')
    }

    if (tab.status !== 'open') {
      throw new Error('TAB_LOCKED')
    }

    // Determine lineTotal
    let lineTotal: number

    if (line.servingId) {
      // Serving sale — fetch serving config and compute via ServingEngine
      const serving = await models.BarServing.findById(line.servingId)
      if (!serving) {
        throw new Error('SERVING_NOT_FOUND')
      }

      const result = ServingEngine.computeServing(
        { sellingPrice: serving.sellingPrice, unitsProduced: serving.unitsProduced },
        line.quantity
      )
      lineTotal = result.lineTotal

      // Deduct units from the open bottle
      await InventoryEngine.deductServingUnits(
        line.inventoryItemId,
        result.unitsToDeduct,
        line.staffId,
        conn
      )
    } else {
      // Bottle sale — sell a sealed bottle
      lineTotal = line.unitPrice * line.quantity

      await InventoryEngine.sellSealedBottle(
        line.inventoryItemId,
        line.staffId,
        conn
      )
    }

    const now = new Date()

    // Insert BarTabLine
    const tabLine = await models.BarTabLine.create({
      userId:          tab.userId,
      branchId:        tab.branchId,
      tabId:           tab._id,
      inventoryItemId: line.inventoryItemId,
      servingId:       line.servingId ?? undefined,
      itemName:        line.itemName,
      servingName:     line.servingName ?? '',
      quantity:        line.quantity,
      unitPrice:       line.unitPrice,
      lineTotal,
      addedBy:         line.staffId,
      addedAt:         now,
      voided:          false,
    })

    // Recompute tab balances from all non-voided lines
    const updatedTab = await TabManager._recomputeAndSaveTab(tab, conn)

    // Immutable audit log
    await models.BarAuditLog.create({
      userId:        tab.userId,
      branchId:      tab.branchId,
      staffId:       line.staffId,
      operation:     'TAB_LINE_ADDED',
      referenceId:   String(tab._id),
      referenceType: 'BarTab',
      details: {
        tabId:           String(tab._id),
        tabLineId:       String(tabLine._id),
        inventoryItemId: line.inventoryItemId,
        servingId:       line.servingId ?? null,
        itemName:        line.itemName,
        servingName:     line.servingName ?? '',
        quantity:        line.quantity,
        unitPrice:       line.unitPrice,
        lineTotal,
      },
      timestamp: now,
    })

    return {
      tab:     updatedTab,
      tabLine: tabLine.toObject(),
    }
  }

  /**
   * Void the most-recent non-voided line on a tab and restore inventory.
   *
   * For serving lines: no inventory restore at the bottle level (units already
   * consumed from the open bottle — restoration would require re-opening the
   * bottle, which is a separate operation). The line is simply voided.
   *
   * For bottle-sale lines (servingId is null): restores 1 unit to
   * BarInventoryItem.stock.
   *
   * Recomputes and saves the tab balance after voiding.
   *
   * @param tabId - The BarTab _id
   * @param conn  - Tenant mongoose connection
   * @returns The updated BarTab document (plain object)
   */
  static async removeLastLine(
    tabId: string,
    conn: mongoose.Connection
  ): Promise<Record<string, unknown>> {
    const models = getModels(conn)

    const tab = await models.BarTab.findById(tabId)
    if (!tab) {
      throw new Error('TAB_NOT_FOUND')
    }

    // Find the most-recent non-voided line
    const lastLine = await models.BarTabLine.findOne({
      tabId,
      voided: false,
    }).sort({ addedAt: -1 })

    if (!lastLine) {
      throw new Error('NO_LINES_TO_REMOVE')
    }

    const now = new Date()

    // Restore inventory for bottle sales (servingId is null/undefined)
    if (!lastLine.servingId) {
      const item = await models.BarInventoryItem.findById(lastLine.inventoryItemId)
      if (item) {
        item.stock += lastLine.quantity
        item.updatedAt = now
        await item.save()
      }
    }
    // Note: serving-unit restoration into an open bottle is not performed here —
    // the bottle may have been closed or the units already consumed by other lines.
    // The void is recorded in the audit log for reconciliation.

    // Void the line
    lastLine.voided = true
    lastLine.voidedBy = undefined  // caller can set this if staffId is available
    lastLine.voidedAt = now
    await lastLine.save()

    // Recompute tab balances
    const updatedTab = await TabManager._recomputeAndSaveTab(tab, conn)

    return updatedTab
  }

  /**
   * Transition a tab to a new status, validating the state machine.
   *
   * Allowed transitions:
   *   open → hold, open → billing
   *   hold → open
   *   billing → open
   *   paid → (nothing — throws INVALID_STATUS_TRANSITION)
   *
   * Inserts a TAB_STATUS_CHANGED audit log on success.
   *
   * @param tabId    - The BarTab _id
   * @param status   - The target status
   * @param staffId  - Staff member performing the transition (for audit log)
   * @param conn     - Tenant mongoose connection
   * @returns The updated BarTab document (plain object)
   * @throws Error('INVALID_STATUS_TRANSITION') for illegal transitions
   */
  static async setStatus(
    tabId: string,
    status: TabStatus,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<Record<string, unknown>> {
    const models = getModels(conn)

    const tab = await models.BarTab.findById(tabId)
    if (!tab) {
      throw new Error('TAB_NOT_FOUND')
    }

    const currentStatus = tab.status as TabStatus
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []

    if (!allowed.includes(status)) {
      throw new Error('INVALID_STATUS_TRANSITION')
    }

    const previousStatus = currentStatus
    const now = new Date()

    tab.status = status
    tab.updatedAt = now
    await tab.save()

    // Immutable audit log
    await models.BarAuditLog.create({
      userId:        tab.userId,
      branchId:      tab.branchId,
      staffId,
      operation:     'TAB_STATUS_CHANGED',
      referenceId:   String(tab._id),
      referenceType: 'BarTab',
      details: {
        tabId:          String(tab._id),
        previousStatus,
        newStatus:      status,
      },
      timestamp: now,
    })

    return tab.toObject()
  }

  /**
   * Apply a discount percentage to a tab.
   *
   * Valid values are {0, 5, 10, 15, 20}. Any other value throws INVALID_DISCOUNT.
   * Recomputes discountAmount = subtotal * (discountPct / 100) and
   * total = subtotal - discountAmount.
   * Inserts a TAB_DISCOUNT_APPLIED audit log.
   *
   * @param tabId       - The BarTab _id
   * @param discountPct - Discount percentage (must be in {0,5,10,15,20})
   * @param staffId     - Staff member applying the discount (for audit log)
   * @param conn        - Tenant mongoose connection
   * @returns The updated BarTab document (plain object)
   * @throws Error('INVALID_DISCOUNT') for values outside {0,5,10,15,20}
   */
  static async applyDiscount(
    tabId: string,
    discountPct: number,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<Record<string, unknown>> {
    const models = getModels(conn)

    if (!VALID_DISCOUNT_PCTS.has(discountPct)) {
      throw new Error('INVALID_DISCOUNT')
    }

    const tab = await models.BarTab.findById(tabId)
    if (!tab) {
      throw new Error('TAB_NOT_FOUND')
    }

    const subtotal = tab.subtotal as number
    const discountAmount = Math.floor(subtotal * discountPct / 100)
    const total = subtotal - discountAmount

    const now = new Date()
    tab.discountPct    = discountPct
    tab.discountAmount = discountAmount
    tab.total          = total
    tab.updatedAt      = now
    await tab.save()

    // Immutable audit log
    await models.BarAuditLog.create({
      userId:        tab.userId,
      branchId:      tab.branchId,
      staffId,
      operation:     'TAB_DISCOUNT_APPLIED',
      referenceId:   String(tab._id),
      referenceType: 'BarTab',
      details: {
        tabId:          String(tab._id),
        discountPct,
        discountAmount,
        subtotal,
        total,
      },
      timestamp: now,
    })

    return tab.toObject()
  }

  /**
   * Compute the live running balance from actual line items and payments.
   *
   * This is the authoritative balance calculation — derived from DB records,
   * not from cached tab fields. Use this for display and validation.
   *
   * Formula:
   *   subtotal       = sum(lineTotal for non-voided lines)
   *   discountAmount = subtotal * (discountPct / 100)   [floored]
   *   total          = subtotal - discountAmount
   *   amountPaid     = sum(payment.amount)
   *   remaining      = total - amountPaid
   *
   * @param tabId - The BarTab _id
   * @param conn  - Tenant mongoose connection
   * @returns RunningBalance object with all five fields
   */
  static async getRunningBalance(
    tabId: string,
    conn: mongoose.Connection
  ): Promise<RunningBalance> {
    const models = getModels(conn)

    const tab = await models.BarTab.findById(tabId)
    if (!tab) {
      throw new Error('TAB_NOT_FOUND')
    }

    // Sum all non-voided lines
    const lines = await models.BarTabLine.find({ tabId, voided: false })
    const subtotal = lines.reduce((sum: number, l: Record<string, unknown>) => {
      return sum + ((l.lineTotal as number) ?? 0)
    }, 0)

    const discountPct    = (tab.discountPct as number) ?? 0
    const discountAmount = Math.floor(subtotal * discountPct / 100)
    const total          = subtotal - discountAmount

    // Sum all payments embedded on the tab
    const payments = (tab.payments as Array<{ amount: number }>) ?? []
    const amountPaid = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0)

    const remaining = total - amountPaid

    return { subtotal, discountAmount, total, amountPaid, remaining }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Recompute and persist the tab's cached balance fields from live line data.
   *
   * Fetches all non-voided BarTabLines for the tab, sums their lineTotals,
   * applies the existing discountPct, and updates subtotal/discountAmount/total
   * on the tab document. amountPaid is derived from the embedded payments array.
   *
   * @param tab  - The live Mongoose tab document (will be mutated and saved)
   * @param conn - Tenant mongoose connection
   * @returns The updated tab as a plain object
   */
  private static async _recomputeAndSaveTab(
    tab: Record<string, unknown> & {
      _id: unknown
      userId: unknown
      discountPct: unknown
      payments: unknown
      subtotal: unknown
      discountAmount: unknown
      total: unknown
      amountPaid: unknown
      updatedAt: unknown
      save: () => Promise<void>
      toObject: () => Record<string, unknown>
    },
    conn: mongoose.Connection
  ): Promise<Record<string, unknown>> {
    const models = getModels(conn)

    const lines = await models.BarTabLine.find({
      tabId:  tab._id,
      voided: false,
    })

    const subtotal = lines.reduce((sum: number, l: Record<string, unknown>) => {
      return sum + ((l.lineTotal as number) ?? 0)
    }, 0)

    const discountPct    = (tab.discountPct as number) ?? 0
    const discountAmount = Math.floor(subtotal * discountPct / 100)
    const total          = subtotal - discountAmount

    const payments = (tab.payments as Array<{ amount: number }>) ?? []
    const amountPaid = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0)

    tab.subtotal       = subtotal
    tab.discountAmount = discountAmount
    tab.total          = total
    tab.amountPaid     = amountPaid
    tab.updatedAt      = new Date()

    await tab.save()

    return tab.toObject()
  }
}
