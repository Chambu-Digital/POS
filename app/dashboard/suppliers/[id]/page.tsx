'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Loader2,
  CreditCard,
  Package,
  CheckCircle2,
  Clock,
  ArrowDownToLine,
  Phone,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { PayablesCard } from '@/components/inventory/payables-card'

interface SupplierDetail {
  _id: string
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  isActive: boolean
}

interface Balance {
  totalOwed: number
  totalAdvances: number
  totalPurchased: number
  netPosition: number
}

interface ReceiptRow {
  _id: string
  receiptNumber: string
  date: string
  paidAt: string | null
  paymentStatus: 'paid' | 'unpaid' | 'prepaid'
  paymentMethod: string
  paymentReference: string
  itemCount: number
  totalUnits: number
  totalCost: number
  reference: string
  notes: string
}

function formatKES(amount: number) {
  return `KES ${Math.round(amount).toLocaleString('en-KE')}`
}

function statusBadge(status: ReceiptRow['paymentStatus']) {
  if (status === 'paid')    return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>
  if (status === 'unpaid')  return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Unpaid</Badge>
  if (status === 'prepaid') return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Advance</Badge>
  return <Badge>{status}</Badge>
}

function SupplierDetailContent() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [supplier, setSupplier] = useState<SupplierDetail | null>(null)
  const [balance, setBalance] = useState<Balance | null>(null)
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) fetchSupplier()
  }, [id])

  async function fetchSupplier() {
    setLoading(true)
    try {
      const res = await fetch(`/api/suppliers/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSupplier(data.supplier)
        setBalance(data.balance)
        setReceipts(data.receipts)
      } else {
        toast.error('Supplier not found')
        router.push('/dashboard/suppliers')
      }
    } catch (error) {
      console.error('Failed to fetch supplier:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!supplier || !balance) return null

  const unpaid   = receipts.filter(r => r.paymentStatus === 'unpaid')
  const prepaid  = receipts.filter(r => r.paymentStatus === 'prepaid')
  const paid     = receipts.filter(r => r.paymentStatus === 'paid')

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/suppliers')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Suppliers
          </Button>
          <div>
            <h1 className="text-xl font-bold">{supplier.name}</h1>
            {!supplier.isActive && (
              <Badge variant="secondary" className="mt-1">Inactive</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Supplier Info */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-green-700 mb-3">Contact Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {supplier.contactPerson && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium text-foreground">{supplier.contactPerson}</span>
            </div>
          )}
          {supplier.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              <span>{supplier.phone}</span>
            </div>
          )}
          {supplier.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              <span>{supplier.email}</span>
            </div>
          )}
          {supplier.address && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{supplier.address}</span>
            </div>
          )}
          {!supplier.contactPerson && !supplier.phone && !supplier.email && !supplier.address && (
            <p className="text-muted-foreground col-span-2">No contact information recorded.</p>
          )}
        </div>
        {supplier.notes && (
          <p className="text-xs text-muted-foreground mt-3 border-t pt-3">{supplier.notes}</p>
        )}
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700 font-medium mb-1">Total Purchased</p>
          <p className="text-xl font-bold text-blue-900">{formatKES(balance.totalPurchased)}</p>
          <p className="text-xs text-blue-600">{paid.length} receipt{paid.length !== 1 ? 's' : ''}</p>
        </div>
        <div className={`rounded-lg p-3 border ${balance.totalOwed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-xs font-medium mb-1 ${balance.totalOwed > 0 ? 'text-amber-700' : 'text-gray-700'}`}>Owed</p>
          <p className={`text-xl font-bold ${balance.totalOwed > 0 ? 'text-amber-900' : 'text-gray-900'}`}>{formatKES(balance.totalOwed)}</p>
          <p className={`text-xs ${balance.totalOwed > 0 ? 'text-amber-600' : 'text-gray-500'}`}>{unpaid.length} unpaid</p>
        </div>
        <div className={`rounded-lg p-3 border ${balance.totalAdvances > 0 ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-xs font-medium mb-1 ${balance.totalAdvances > 0 ? 'text-purple-700' : 'text-gray-700'}`}>Advances Out</p>
          <p className={`text-xl font-bold ${balance.totalAdvances > 0 ? 'text-purple-900' : 'text-gray-900'}`}>{formatKES(balance.totalAdvances)}</p>
          <p className={`text-xs ${balance.totalAdvances > 0 ? 'text-purple-600' : 'text-gray-500'}`}>{prepaid.length} pending delivery</p>
        </div>
        <div className={`rounded-lg p-3 border ${balance.netPosition > 0 ? 'bg-red-50 border-red-200' : balance.netPosition < 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-xs font-medium mb-1 ${balance.netPosition > 0 ? 'text-red-700' : balance.netPosition < 0 ? 'text-green-700' : 'text-gray-700'}`}>Net Position</p>
          <p className={`text-xl font-bold ${balance.netPosition > 0 ? 'text-red-900' : balance.netPosition < 0 ? 'text-green-900' : 'text-gray-900'}`}>
            {formatKES(Math.abs(balance.netPosition))}
          </p>
          <p className={`text-xs ${balance.netPosition > 0 ? 'text-red-600' : balance.netPosition < 0 ? 'text-green-600' : 'text-gray-500'}`}>
            {balance.netPosition > 0 ? 'You owe' : balance.netPosition < 0 ? 'They owe goods' : 'Clear'}
          </p>
        </div>
      </div>

      {/* Payables card for this supplier — handles pay + record advance */}
      <PayablesCard supplierId={id} onPaymentRecorded={fetchSupplier} />

      {/* Transaction history */}
      {receipts.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-green-700 mb-3">Transaction History</h3>
          <div className="space-y-2">
            {receipts.map((r) => (
              <div key={r._id} className="flex items-center justify-between gap-3 border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{r.receiptNumber}</p>
                    {statusBadge(r.paymentStatus)}
                    {r.paymentStatus === 'prepaid' && (
                      <span className="flex items-center gap-1 text-xs text-purple-600">
                        <ArrowDownToLine className="h-3 w-3" />
                        Goods pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    {r.itemCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {r.itemCount} items · {r.totalUnits} units
                      </span>
                    )}
                    {r.paymentMethod && (
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {r.paymentMethod}
                        {r.paymentReference && ` · ${r.paymentReference}`}
                      </span>
                    )}
                    {r.paidAt && r.paymentStatus === 'paid' && r.date !== r.paidAt && (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Paid {new Date(r.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                    {r.reference && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {r.reference}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{formatKES(r.totalCost)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {receipts.length === 0 && (
        <div className="bg-white rounded-lg border p-8 text-center">
          <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium">No transactions yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Stock received from this supplier will appear here.
          </p>
        </div>
      )}
    </div>
  )
}

export default function SupplierDetailPage() {
  return (
    <PermissionGuard requiredPermission="core.suppliers">
      <SupplierDetailContent />
    </PermissionGuard>
  )
}
