'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { CreditCard, Loader2, Clock, Plus, ArrowDownToLine, PackageSearch, ChevronsUpDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import { QuickAddSupplierDialog } from '@/components/suppliers/quick-add-supplier-dialog'

interface Payable {
  _id: string
  receiptNumber: string
  supplierName: string
  date: string
  totalCost: number
  items: Array<{
    itemName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  reference: string
  notes: string
}

interface Advance {
  _id: string
  receiptNumber: string
  supplierName: string
  date: string
  paidAt: string
  totalCost: number
  paymentMethod: string
  bankProviderName?: string
  customMethodName?: string
  notes: string
}

interface SupplierOption {
  _id: string
  name: string
}

function formatKES(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString('en-KE')}`
}

interface PayablesCardProps {
  onPaymentRecorded?: () => void
  supplierId?: string   // when set, scopes payables + advances to this supplier only
}

export function PayablesCard({ onPaymentRecorded, supplierId }: PayablesCardProps) {
  const [payables, setPayables] = useState<Payable[]>([])
  const [advances, setAdvances] = useState<Advance[]>([])
  const [loading, setLoading] = useState(true)
  const [payingReceipt, setPayingReceipt] = useState<Payable | null>(null)
  const [payMethod, setPayMethod] = useState('cash')
  // Advance dialog state
  const [showAdvance, setShowAdvance] = useState(false)
  const [advSupplierId, setAdvSupplierId]   = useState('')
  const [advSuppliers, setAdvSuppliers]     = useState<SupplierOption[]>([])
  const [advSupOpen, setAdvSupOpen]         = useState(false)
  const [advQuickAdd, setAdvQuickAdd]       = useState(false)
  const [advAmount, setAdvAmount] = useState('')
  const [advMethod, setAdvMethod] = useState('cash')
  const [advBankId, setAdvBankId] = useState('')
  const [advCustomMethodValue, setAdvCustomMethodValue] = useState('')
  const [advReference, setAdvReference] = useState('')
  const [advNotes, setAdvNotes] = useState('')
  const [recordingAdvance, setRecordingAdvance] = useState(false)
  const [selectedBankId, setSelectedBankId] = useState('')
  const [selectedCustomMethodId, setSelectedCustomMethodId] = useState('')
  const [payReference, setPayReference] = useState('')
  const [paying, setPaying] = useState(false)
  const [bankProviders, setBankProviders] = useState<Array<{ _id: string; name: string }>>([])
  const [customMethods, setCustomMethods] = useState<Array<{ _id: string; name: string }>>([])

  useEffect(() => {
    fetchPayables()
    fetchAdvances()
    fetchPaymentMethods()
    fetchSuppliers()
  }, [])

  async function fetchSuppliers() {
    try {
      const res = await fetch('/api/suppliers')
      if (res.ok) setAdvSuppliers((await res.json()).suppliers || [])
    } catch { /* silent */ }
  }

  async function fetchPaymentMethods() {
    try {
      const [bankRes, customRes] = await Promise.all([
        fetch('/api/bank-providers'),
        fetch('/api/payment-methods'),
      ])
      if (bankRes.ok) setBankProviders((await bankRes.json()).providers || [])
      if (customRes.ok) setCustomMethods((await customRes.json()).methods || [])
    } catch (error) {
      console.error('Failed to load payment methods:', error)
    }
  }

  async function fetchPayables() {
    setLoading(true)
    try {
      const qs = supplierId ? `?status=unpaid&supplierId=${supplierId}` : '?status=unpaid'
      const res = await fetch(`/api/stock-receipts${qs}`)
      if (res.ok) {
        const data = await res.json()
        setPayables(data.receipts || [])
      }
    } catch (error) {
      console.error('Failed to load payables:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchAdvances() {
    try {
      const qs = supplierId ? `?status=prepaid&supplierId=${supplierId}` : '?status=prepaid'
      const res = await fetch(`/api/stock-receipts${qs}`)
      if (res.ok) {
        const data = await res.json()
        setAdvances(data.receipts || [])
      }
    } catch (error) {
      console.error('Failed to load advances:', error)
    }
  }

  function openPayDialog(receipt: Payable) {
    setPayingReceipt(receipt)
    setPayMethod('cash')
    setSelectedBankId('')
    setSelectedCustomMethodId('')
    setPayReference('')
  }

  async function handlePay() {
    if (!payingReceipt) return

    const isCustom = payMethod.startsWith('custom:')
    const normalizedMethod = isCustom ? 'custom' : payMethod
    const resolvedCustomId = isCustom ? payMethod.split(':')[1] : ''
    const resolvedCustomName = resolvedCustomId
      ? customMethods.find(m => m._id === resolvedCustomId)?.name || ''
      : ''
    const resolvedBankName = selectedBankId
      ? bankProviders.find(b => b._id === selectedBankId)?.name || ''
      : ''

    if (normalizedMethod === 'bank' && !selectedBankId) {
      toast.error('Select a bank')
      return
    }

    setPaying(true)
    try {
      const res = await fetch(`/api/stock-receipts/${payingReceipt._id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: normalizedMethod,
          bankProviderId: normalizedMethod === 'bank' ? selectedBankId : '',
          bankProviderName: normalizedMethod === 'bank' ? resolvedBankName : '',
          customMethodId: normalizedMethod === 'custom' ? resolvedCustomId : '',
          customMethodName: normalizedMethod === 'custom' ? resolvedCustomName : '',
          paymentReference: payReference,
        }),
      })

      if (res.ok) {
        toast.success(`Paid ${formatKES(payingReceipt.totalCost)} to ${payingReceipt.supplierName}`)
        setPayingReceipt(null)
        fetchPayables()
        onPaymentRecorded?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to record payment')
      }
    } catch (error) {
      toast.error('Failed to record payment')
      console.error(error)
    } finally {
      setPaying(false)
    }
  }

  async function handleRecordAdvance() {
    if (!advSupplierId) { toast.error('Select a supplier'); return }
    if (!advAmount || parseFloat(advAmount) <= 0) { toast.error('Enter a valid amount'); return }
    if (!advMethod) { toast.error('Select a payment method'); return }

    const isCustom = advMethod.startsWith('custom:')
    const normalizedMethod = isCustom ? 'custom' : advMethod
    const resolvedCustomId = isCustom ? advMethod.split(':')[1] : ''
    const resolvedCustomName = resolvedCustomId
      ? customMethods.find(m => m._id === resolvedCustomId)?.name || ''
      : ''
    const resolvedBankName = advBankId
      ? bankProviders.find(b => b._id === advBankId)?.name || ''
      : ''

    if (normalizedMethod === 'bank' && !advBankId) { toast.error('Select a bank'); return }

    const selectedSupplier = advSuppliers.find(s => s._id === advSupplierId)

    setRecordingAdvance(true)
    try {
      const res = await fetch('/api/stock-receipts/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId:       advSupplierId,
          supplierName:     selectedSupplier?.name || '',
          amount:           parseFloat(advAmount),
          paymentMethod:    normalizedMethod,
          bankProviderId:   normalizedMethod === 'bank' ? advBankId : '',
          bankProviderName: normalizedMethod === 'bank' ? resolvedBankName : '',
          customMethodId:   normalizedMethod === 'custom' ? resolvedCustomId : '',
          customMethodName: normalizedMethod === 'custom' ? resolvedCustomName : '',
          paymentReference: advReference,
          notes:            advNotes,
        }),
      })

      if (res.ok) {
        toast.success(`Advance of ${formatKES(parseFloat(advAmount))} recorded for ${selectedSupplier?.name}`)
        setShowAdvance(false)
        setAdvSupplierId('')
        setAdvAmount('')
        setAdvMethod('cash')
        setAdvBankId('')
        setAdvReference('')
        setAdvNotes('')
        fetchAdvances()
        onPaymentRecorded?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to record advance')
      }
    } catch (error) {
      toast.error('Failed to record advance')
      console.error(error)
    } finally {
      setRecordingAdvance(false)
    }
  }

  const totalOwed = payables.reduce((sum, p) => sum + p.totalCost, 0)
  const totalAdvances = advances.reduce((sum, a) => sum + a.totalCost, 0)

  function resolveAdvanceMethod(a: Advance): string {
    if (a.paymentMethod === 'cash') return 'Cash'
    if (a.paymentMethod === 'mobile_money') return 'M-Pesa'
    if (a.paymentMethod === 'bank' && a.bankProviderName) return a.bankProviderName
    if (a.paymentMethod === 'custom' && a.customMethodName) return a.customMethodName
    return a.paymentMethod || 'Unknown'
  }

  return (
    <>
      <Card className={payables.length > 0 ? 'border-amber-200' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2 text-amber-700">
              <CreditCard className="h-4 w-4" />
              Payables
            </span>
            <div className="flex items-center gap-2">
              {totalOwed > 0 && (
                <span className="text-xs font-normal text-amber-600">
                  {formatKES(totalOwed)} outstanding
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => setShowAdvance(true)}
              >
                <Plus className="h-3 w-3" />
                Record Advance
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Payables section ─────────────────────────────────────────── */}
          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : payables.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No outstanding payables. Amounts owed to suppliers will appear here when you receive stock on credit.
            </p>
          ) : (
            <div className="space-y-2">
              {payables.map((receipt) => {
                const totalUnits = receipt.items.reduce((s, i) => s + i.quantity, 0)
                return (
                  <div
                    key={receipt._id}
                    className="flex items-center justify-between gap-3 border rounded-lg p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{receipt.receiptNumber}</p>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(receipt.date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {receipt.supplierName} · {receipt.items.length} items · {totalUnits} units
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold">{formatKES(receipt.totalCost)}</span>
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => openPayDialog(receipt)}
                      >
                        Pay
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Advances pending delivery ─────────────────────────────────── */}
          {advances.length > 0 && (
            <div>
              {(payables.length > 0) && <div className="border-t" />}
              <div className="flex items-center justify-between mb-2 pt-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-purple-700">
                  <PackageSearch className="h-3.5 w-3.5" />
                  Advances Pending Delivery
                </span>
                <span className="text-xs font-medium text-purple-600">
                  {formatKES(totalAdvances)} out
                </span>
              </div>
              <div className="space-y-2">
                {advances.map((adv) => (
                  <div
                    key={adv._id}
                    className="flex items-center justify-between gap-3 border border-purple-100 bg-purple-50/40 rounded-lg p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{adv.receiptNumber}</p>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(adv.paidAt || adv.date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {adv.supplierName} · {resolveAdvanceMethod(adv)}
                        {adv.notes ? ` · ${adv.notes}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <span className="text-sm font-bold text-purple-700">{formatKES(adv.totalCost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={!!payingReceipt} onOpenChange={(open) => !open && setPayingReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Settle Payable
            </DialogTitle>
            <DialogDescription>Record a payment for this stock receipt</DialogDescription>
          </DialogHeader>

          {payingReceipt && (
            <div className="space-y-4">
              {/* Receipt summary */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt</span>
                  <span className="font-medium">{payingReceipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier</span>
                  <span className="font-medium">{payingReceipt.supplierName}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t">
                  <span className="font-medium">Amount Owed</span>
                  <span className="font-bold text-base">{formatKES(payingReceipt.totalCost)}</span>
                </div>
              </div>

              {/* Payment method — dynamic */}
              <div>
                <Label className="text-xs text-muted-foreground">Payment Method</Label>
                <select
                  value={payMethod}
                  onChange={e => {
                    setPayMethod(e.target.value)
                    setSelectedBankId('')
                  }}
                  className="w-full h-9 px-3 border rounded-md text-sm mt-1 bg-background"
                >
                  <optgroup label="Standard Methods">
                    <option value="cash">Cash</option>
                    <option value="mobile_money">M-Pesa / Mobile Money</option>
                    <option value="card">Card</option>
                    {bankProviders.length > 0 && <option value="bank">Bank Transfer</option>}
                  </optgroup>
                  {customMethods.length > 0 && (
                    <optgroup label="Custom Methods">
                      {customMethods.map(m => (
                        <option key={m._id} value={`custom:${m._id}`}>{m.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Bank picker */}
              {payMethod === 'bank' && (
                <div>
                  <Label className="text-xs text-muted-foreground">Bank</Label>
                  <select
                    value={selectedBankId}
                    onChange={e => setSelectedBankId(e.target.value)}
                    className="w-full h-9 px-3 border rounded-md text-sm mt-1 bg-background"
                  >
                    <option value="">Select bank…</option>
                    {bankProviders.map(b => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reference */}
              <div>
                <Label className="text-xs text-muted-foreground">Reference (optional)</Label>
                <Input
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="MPESA code, receipt no."
                  className="mt-1"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPayingReceipt(null)}
                  disabled={paying}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handlePay}
                  disabled={paying}
                >
                  {paying ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Paying...</>
                  ) : (
                    <>Pay {formatKES(payingReceipt.totalCost)}</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Advance Dialog */}
      <Dialog open={showAdvance} onOpenChange={setShowAdvance}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Record Advance Payment
            </DialogTitle>
            <DialogDescription>Pay a supplier now for goods arriving later</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Supplier combobox */}
            <div>
              <Label className="text-xs text-muted-foreground">Supplier *</Label>
              <div className="flex gap-2 mt-1">
                <Popover open={advSupOpen} onOpenChange={setAdvSupOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal" type="button">
                      {advSupplierId
                        ? advSuppliers.find(s => s._id === advSupplierId)?.name || 'Select supplier…'
                        : 'Select supplier…'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search suppliers…" />
                      <CommandList>
                        <CommandEmpty>No supplier found.</CommandEmpty>
                        <CommandGroup>
                          {advSuppliers.filter((s: any) => s.isActive !== false).map(s => (
                            <CommandItem key={s._id} value={s.name}
                              onSelect={() => { setAdvSupplierId(s._id); setAdvSupOpen(false) }}>
                              <Check className={cn('mr-2 h-4 w-4', advSupplierId === s._id ? 'opacity-100' : 'opacity-0')} />
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon"
                  onClick={() => setAdvQuickAdd(true)} title="Add new supplier">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Amount Paid (KES)</Label>
              <Input
                type="number"
                min="0"
                value={advAmount}
                onChange={e => setAdvAmount(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Payment Method</Label>
              <select
                value={advMethod}
                onChange={e => { setAdvMethod(e.target.value); setAdvBankId('') }}
                className="w-full h-9 px-3 border rounded-md text-sm mt-1 bg-background"
              >
                <optgroup label="Standard Methods">
                  <option value="cash">Cash</option>
                  <option value="mobile_money">M-Pesa / Mobile Money</option>
                  <option value="card">Card</option>
                  {bankProviders.length > 0 && <option value="bank">Bank Transfer</option>}
                </optgroup>
                {customMethods.length > 0 && (
                  <optgroup label="Custom Methods">
                    {customMethods.map(m => (
                      <option key={m._id} value={`custom:${m._id}`}>{m.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            {advMethod === 'bank' && (
              <div>
                <Label className="text-xs text-muted-foreground">Bank</Label>
                <select
                  value={advBankId}
                  onChange={e => setAdvBankId(e.target.value)}
                  className="w-full h-9 px-3 border rounded-md text-sm mt-1 bg-background"
                >
                  <option value="">Select bank…</option>
                  {bankProviders.map(b => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Reference (optional)</Label>
              <Input
                value={advReference}
                onChange={e => setAdvReference(e.target.value)}
                placeholder="MPESA code, receipt no."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
              <Input
                value={advNotes}
                onChange={e => setAdvNotes(e.target.value)}
                placeholder="e.g. for 50 tyres expected next week"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowAdvance(false)} disabled={recordingAdvance}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleRecordAdvance} disabled={recordingAdvance}>
                {recordingAdvance ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : 'Record Advance'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuickAddSupplierDialog
        open={advQuickAdd}
        onOpenChange={setAdvQuickAdd}
        onSuccess={s => {
          setAdvSuppliers(prev => [...prev, s as any])
          setAdvSupplierId(s._id)
        }}
      />
    </>
  )
}
