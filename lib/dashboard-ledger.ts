/**
 * Shared customer-ledger processing for the dashboard stats and breakdown routes.
 *
 * Both routes query today's customer ledger entries and need to produce identical
 * totals. Previously each route had its own bespoke loop, leading to disagreements
 * between the summary chips and the drill-down page. This module is the single
 * source of truth for how ledger entries become dashboard numbers.
 *
 * Ledger entry types handled:
 *   'payment'          → credit settlement (customer pays off their debt) — real cash IN
 *   'deposit'          → customer prepayment received — real cash IN by method
 *   'deposit_refund'   → prepayment returned to customer — real cash OUT by method
 *
 * NOT handled here (live on Sale documents):
 *   'purchase' / 'deposit_use' / 'deposit_return' — these affect balances but not
 *   today's cash position (no new cash moves on those entries).
 */

// ── Method name resolver ──────────────────────────────────────────────────────
// Returns the RAW method key (lowercase, matching sale.payments[].method) so
// deposit and sale amounts accumulate under the same key in byPayment.
// Display-name conversion (cash → Cash, mobile_money → M-Pesa) is done in the
// frontend — keeping raw keys here avoids the case-mismatch bug where 'cash'
// and 'Cash' were treated as separate entries.
export function resolveLedgerMethodKey(entry: any): string {
  if (entry.paymentMethod === 'cash') return 'cash'
  if (entry.paymentMethod === 'mobile_money') return 'mobile_money'
  if (entry.paymentMethod === 'card') return 'card'
  if (entry.paymentMethod === 'bank' && entry.bankProviderName) return entry.bankProviderName
  if (entry.paymentMethod === 'custom' && entry.customMethodName) return entry.customMethodName
  if (entry.paymentMethod) return entry.paymentMethod
  return 'cash'
}

// ── Shapes returned by processLedgerEntries ───────────────────────────────────

export interface CreditPayment {
  _id: string
  customerName: string
  amount: number
  note: string
  date: Date | string
}

export interface DepositReceipt {
  _id: string
  customerName: string
  customerId: string
  depositId: string | null
  amount: number
  methodKey: string     // raw key (cash, mobile_money, bank name, …)
  methodLabel: string   // display label for the receipt row
  paymentReference: string
  date: Date | string
  note: string
}

export interface LedgerResult {
  creditPayments: CreditPayment[]
  depositReceipts: DepositReceipt[]
  /** cash inflows by raw method key — creditPayments and depositReceipts combined */
  byPaymentFromLedger: Record<string, number>
  /** cash outflows by raw method key (deposit refunds — reduces net) */
  depositRefundsByMethod: Record<string, number>
  creditCollectedTotal: number
  depositsReceivedTotal: number
}

// ── Main processor ────────────────────────────────────────────────────────────

/**
 * Walk a list of customers (already filtered to today's date range by the
 * caller's MongoDB query) and extract all cash-movement ledger entries.
 *
 * @param customers   Array of lean Customer documents (must include `.ledger`)
 * @param startOfDay  Start of the reporting period
 * @param endOfDay    End of the reporting period
 * @param staffScopeId  When set, only include entries collected by this staff member
 */
export function processLedgerEntries(
  customers: any[],
  startOfDay: Date,
  endOfDay: Date,
  staffScopeId?: string | null
): LedgerResult {
  const creditPayments: CreditPayment[] = []
  const depositReceipts: DepositReceipt[] = []
  const byPaymentFromLedger: Record<string, number> = {}
  const depositRefundsByMethod: Record<string, number> = {}
  let creditCollectedTotal = 0
  let depositsReceivedTotal = 0

  for (const customer of customers) {
    for (const entry of customer.ledger ?? []) {
      const entryDate = new Date(entry.date)
      if (entryDate < startOfDay || entryDate > endOfDay) continue

      // Staff scoping — only entries collected by this staff member
      if (staffScopeId && entry.collectedBy?.toString() !== staffScopeId) continue

      if (entry.type === 'payment' && entry.amount < 0) {
        // Credit settlement — customer paid off (part of) their debt.
        // Real cash IN by method.
        const amount = Math.abs(entry.amount)
        const methodKey = resolveLedgerMethodKey(entry)
        byPaymentFromLedger[methodKey] = (byPaymentFromLedger[methodKey] || 0) + amount
        creditCollectedTotal += amount
        creditPayments.push({
          _id: entry._id?.toString() || `${customer._id}-${entry.date}`,
          customerName: customer.name,
          amount,
          note: entry.note || '',
          date: entry.date,
        })

      } else if (entry.type === 'deposit' && entry.amount > 0) {
        // Customer prepayment received — real cash IN by method.
        // Deposited money belongs to the same cash-by-method bucket as a sale
        // paid via that method, so it accumulates in byPaymentFromLedger.
        const methodKey = resolveLedgerMethodKey(entry)
        byPaymentFromLedger[methodKey] = (byPaymentFromLedger[methodKey] || 0) + entry.amount
        depositsReceivedTotal += entry.amount

        let methodLabel = methodKey
        if (methodKey === 'cash') methodLabel = 'Cash'
        else if (methodKey === 'mobile_money') methodLabel = 'M-Pesa'
        else if (methodKey === 'card') methodLabel = 'Card'

        depositReceipts.push({
          _id: entry._id?.toString() || `dep-${customer._id}-${entry.date}`,
          customerName: customer.name,
          customerId: customer._id?.toString() || '',
          depositId: entry.depositId?.toString() || null,
          amount: entry.amount,
          methodKey,
          methodLabel: entry.bankProviderName || entry.customMethodName || methodLabel,
          paymentReference: entry.mpesaCode || '',
          date: entry.date,
          note: entry.note || '',
        })

      } else if (entry.type === 'deposit_refund' && entry.amount < 0) {
        // Deposit refund — real cash OUT by method (reduces net position).
        const refundAmount = Math.abs(entry.amount)
        const methodKey = resolveLedgerMethodKey(entry)
        depositRefundsByMethod[methodKey] = (depositRefundsByMethod[methodKey] || 0) + refundAmount
      }
    }
  }

  return {
    creditPayments,
    depositReceipts,
    byPaymentFromLedger,
    depositRefundsByMethod,
    creditCollectedTotal,
    depositsReceivedTotal,
  }
}

/**
 * Merge byPayment from sales with byPaymentFromLedger additively.
 * Uses additive merge (not object spread) to prevent same-key overwrite.
 */
export function mergeByPayment(
  fromSales: Record<string, number>,
  fromLedger: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = { ...fromSales }
  for (const [method, amount] of Object.entries(fromLedger)) {
    merged[method] = (merged[method] || 0) + amount
  }
  return merged
}
