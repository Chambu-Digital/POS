import { useBarStore } from '@/store/bar-store'

export function RunningBalanceBar() {
  const { activeTab } = useBarStore()
  if (!activeTab) return null

  return (
    <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>KES {activeTab.subtotal.toLocaleString()}</span>
      </div>
      {activeTab.discountAmount > 0 && (
        <div className="flex justify-between text-red-500">
          <span>Discount ({activeTab.discountPct}%)</span>
          <span>- KES {activeTab.discountAmount.toLocaleString()}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
        <span>Total</span>
        <span>KES {activeTab.total.toLocaleString()}</span>
      </div>
      {activeTab.amountPaid > 0 && (
        <div className="flex justify-between text-green-600">
          <span>Amount Paid</span>
          <span>KES {activeTab.amountPaid.toLocaleString()}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
        <span>Remaining</span>
        <span>KES {activeTab.remaining !== undefined ? activeTab.remaining.toLocaleString() : (activeTab.total - activeTab.amountPaid).toLocaleString()}</span>
      </div>
    </div>
  )
}
