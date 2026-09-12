'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  FileText, 
  Loader2,
  ArrowLeft,
  Printer,
  CheckCircle2,
  Clock,
  Send,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  History
} from 'lucide-react'
import { PermissionGuard } from '@/components/auth/permission-guard'

interface PurchaseOrder {
  _id: string
  poNumber: string
  supplierId: string | null
  supplierName: string
  status: 'draft' | 'approved' | 'sent' | 'received' | 'cancelled'
  items: Array<{
    moduleItemId: string
    module: string
    itemName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  total: number
  notes: string
  editHistory?: Array<{
    editedBy: string
    editedByModel: string
    editedAt: string
    changes: Array<{
      field: string
      oldValue: any
      newValue: any
    }>
  }>
  createdAt: string
  createdBy: string
}

function PurchaseOrderDetailPageContent() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [editedItems, setEditedItems] = useState<PurchaseOrder['items']>([])
  const [editedNotes, setEditedNotes] = useState('')

  useEffect(() => {
    if (id) {
      fetchPurchaseOrder()
    }
  }, [id])

  async function fetchPurchaseOrder() {
    setLoading(true)
    try {
      const response = await fetch(`/api/restocking/purchase-orders/${id}`)
      if (response.ok) {
        const data = await response.json()
        setPurchaseOrder(data.purchaseOrder)
      } else {
        alert('Purchase order not found')
        router.push('/dashboard/restocking/purchase-orders')
      }
    } catch (error) {
      console.error('Failed to fetch purchase order:', error)
      alert('Failed to load purchase order')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(newStatus: string) {
    if (!purchaseOrder) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/restocking/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        fetchPurchaseOrder()
      } else {
        alert('Failed to update status')
      }
    } catch (error) {
      console.error('Failed to update status:', error)
      alert('Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  function startEditing() {
    if (!purchaseOrder) return
    setEditedItems(JSON.parse(JSON.stringify(purchaseOrder.items)))
    setEditedNotes(purchaseOrder.notes)
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setEditedItems([])
    setEditedNotes('')
  }

  function updateEditedItem(index: number, field: string, value: any) {
    const updated = [...editedItems]
    updated[index] = {
      ...updated[index],
      [field]: field === 'quantity' || field === 'unitPrice' ? parseFloat(value) || 0 : value
    }
    // Recalculate lineTotal
    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].lineTotal = updated[index].quantity * updated[index].unitPrice
    }
    setEditedItems(updated)
  }

  function removeEditedItem(index: number) {
    setEditedItems(editedItems.filter((_, i) => i !== index))
  }

  async function saveEdits() {
    if (!purchaseOrder) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/restocking/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editedItems,
          notes: editedNotes
        })
      })

      if (response.ok) {
        setIsEditing(false)
        fetchPurchaseOrder()
        alert('Purchase order updated successfully')
      } else {
        const error = await response.json()
        alert(`Failed to update: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to save edits:', error)
      alert('Failed to save changes')
    } finally {
      setUpdating(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Draft</Badge>
      case 'approved':
        return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>
      case 'sent':
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Sent</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!purchaseOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold">Purchase Order Not Found</h2>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-32 sm:pb-6">
      {/* Header - No Print */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="space-y-3 w-full sm:w-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/restocking/purchase-orders')}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to POs
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{purchaseOrder.poNumber}</h1>
            <p className="text-sm text-muted-foreground">{purchaseOrder.supplierName}</p>
          </div>
        </div>
        
        {/* Desktop Actions */}
        <div className="hidden sm:flex gap-2 w-full sm:w-auto">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={cancelEditing}
                disabled={updating}
                className="w-full sm:w-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={saveEdits}
                disabled={updating}
                className="gap-2 w-full sm:w-auto"
              >
                {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              {purchaseOrder.status === 'draft' && (
                <>
                  <Button
                    variant="outline"
                    onClick={startEditing}
                    className="gap-2 w-full sm:w-auto"
                  >
                    <Edit className="h-4 w-4" />
                    Edit PO
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateStatus('approved')}
                    disabled={updating}
                    className="gap-2 w-full sm:w-auto"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                </>
              )}
              {purchaseOrder.status === 'approved' && (
                <Button
                  variant="outline"
                  onClick={() => updateStatus('sent')}
                  disabled={updating}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Send className="h-4 w-4" />
                  Mark as Sent
                </Button>
              )}
              {purchaseOrder.editHistory && purchaseOrder.editHistory.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setShowHistory(!showHistory)}
                  className="gap-2 w-full sm:w-auto"
                >
                  <History className="h-4 w-4" />
                  History ({purchaseOrder.editHistory.length})
                </Button>
              )}
              <Button onClick={handlePrint} className="gap-2 w-full sm:w-auto">
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-40 print:hidden">
        {isEditing ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={cancelEditing}
              disabled={updating}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={saveEdits}
              disabled={updating}
              className="gap-2 flex-1"
            >
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {purchaseOrder.status === 'draft' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={startEditing}
                  className="gap-2 flex-1"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  onClick={() => updateStatus('approved')}
                  disabled={updating}
                  className="gap-2 flex-1"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
              </div>
            )}
            {purchaseOrder.status === 'approved' && (
              <Button
                onClick={() => updateStatus('sent')}
                disabled={updating}
                className="gap-2 w-full"
              >
                <Send className="h-4 w-4" />
                Mark as Sent
              </Button>
            )}
            <div className="flex gap-2">
              {purchaseOrder.editHistory && purchaseOrder.editHistory.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setShowHistory(!showHistory)}
                  className="gap-2 flex-1"
                >
                  <History className="h-4 w-4" />
                  History
                </Button>
              )}
              <Button onClick={handlePrint} variant="outline" className="gap-2 flex-1">
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Status Badge - No Print */}
      <div className="print:hidden">
        {getStatusBadge(purchaseOrder.status)}
      </div>

      {/* Printable PO */}
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8 space-y-6">
          {/* Header - Print Only */}
          <div className="hidden print:block text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">PURCHASE ORDER</h1>
            <p className="text-lg text-muted-foreground">{purchaseOrder.poNumber}</p>
          </div>

          {/* PO Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">VENDOR</h3>
              <p className="font-medium text-base sm:text-lg">{purchaseOrder.supplierName}</p>
            </div>
            <div className="sm:text-right">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">PO DATE</h3>
              <p className="font-medium">
                {new Date(purchaseOrder.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div>
            {/* Desktop Table View - Hidden on mobile */}
            <div className="hidden lg:block border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium text-sm">Item Description</th>
                      <th className="text-right p-3 font-medium text-sm">Quantity</th>
                      <th className="text-right p-3 font-medium text-sm">Unit Price</th>
                      <th className="text-right p-3 font-medium text-sm">Total</th>
                      {isEditing && <th className="text-center p-3 font-medium text-sm w-20">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditing ? editedItems : purchaseOrder.items).map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-3">{item.itemName}</td>
                        <td className="p-3 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity || ''}
                              onChange={(e) => updateEditedItem(index, 'quantity', e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="w-20 h-8 text-right ml-auto"
                            />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice || ''}
                              onChange={(e) => updateEditedItem(index, 'unitPrice', e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="w-28 h-8 text-right ml-auto"
                            />
                          ) : (
                            `KES ${item.unitPrice.toLocaleString()}`
                          )}
                        </td>
                        <td className="p-3 text-right font-medium">
                          KES {item.lineTotal.toLocaleString()}
                        </td>
                        {isEditing && (
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeEditedItem(index)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50">
                    <tr className="border-t-2">
                      <td colSpan={3} className="p-3 text-right font-semibold">TOTAL</td>
                      <td className="p-3 text-right font-bold text-lg">
                        KES {isEditing 
                          ? editedItems.reduce((sum, item) => sum + item.lineTotal, 0).toLocaleString()
                          : purchaseOrder.total.toLocaleString()
                        }
                      </td>
                      {isEditing && <td></td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Mobile Card View - View Mode */}
            {!isEditing && (
              <div className="lg:hidden space-y-3">
                {purchaseOrder.items.map((item, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-base mb-3">{item.itemName}</h4>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Quantity</p>
                          <p className="font-medium">{item.quantity}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Unit Price</p>
                          <p className="font-medium">KES {item.unitPrice.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Total</p>
                          <p className="font-semibold">KES {item.lineTotal.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {/* Mobile Total Card */}
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-base">TOTAL</span>
                      <span className="font-bold text-lg">
                        KES {purchaseOrder.total.toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Mobile Card View - Edit Mode */}
            {isEditing && (
              <div className="lg:hidden space-y-3">
                {editedItems.map((item, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-base flex-1">{item.itemName}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEditedItem(index)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground mb-1 block">
                            Quantity
                          </label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity || ''}
                            onChange={(e) => updateEditedItem(index, 'quantity', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full h-10"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium text-muted-foreground mb-1 block">
                            Unit Price (KES)
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice || ''}
                            onChange={(e) => updateEditedItem(index, 'unitPrice', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full h-10"
                          />
                        </div>

                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Line Total</span>
                            <span className="font-bold">KES {item.lineTotal.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {/* Mobile Total Card - Edit Mode */}
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-base">TOTAL</span>
                      <span className="font-bold text-lg">
                        KES {editedItems.reduce((sum, item) => sum + item.lineTotal, 0).toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">NOTES</h3>
            {isEditing ? (
              <Textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="Add notes..."
                rows={3}
                className="text-sm"
              />
            ) : (
              purchaseOrder.notes && <p className="text-sm whitespace-pre-wrap">{purchaseOrder.notes}</p>
            )}
          </div>

          {/* Footer - Print Only */}
          <div className="hidden print:block mt-12 pt-8 border-t">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="font-semibold mb-8">Authorized By:</p>
                <div className="border-t pt-2">
                  <p className="text-sm text-muted-foreground">Signature</p>
                </div>
              </div>
              <div>
                <p className="font-semibold mb-8">Received By:</p>
                <div className="border-t pt-2">
                  <p className="text-sm text-muted-foreground">Signature & Date</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Card - No Print */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Items:</span>
            <span className="font-medium">
              {isEditing ? editedItems.length : purchaseOrder.items.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Units:</span>
            <span className="font-medium">
              {isEditing 
                ? editedItems.reduce((sum, item) => sum + item.quantity, 0)
                : purchaseOrder.items.reduce((sum, item) => sum + item.quantity, 0)
              }
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="font-semibold">Grand Total:</span>
            <span className="font-bold text-lg">
              KES {isEditing 
                ? editedItems.reduce((sum, item) => sum + item.lineTotal, 0).toLocaleString()
                : purchaseOrder.total.toLocaleString()
              }
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Edit History - No Print */}
      {showHistory && purchaseOrder.editHistory && purchaseOrder.editHistory.length > 0 && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Edit History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {purchaseOrder.editHistory.map((entry, index) => (
                <div key={index} className="border-l-2 border-blue-500 pl-4 py-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      Edited by {entry.editedByModel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.editedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {entry.changes.map((change, changeIndex) => (
                      <div key={changeIndex} className="text-sm">
                        <span className="font-medium">{change.field}:</span>{' '}
                        <span className="text-red-600 line-through">{JSON.stringify(change.oldValue)}</span>
                        {' → '}
                        <span className="text-green-600">{JSON.stringify(change.newValue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function PurchaseOrderDetailPage() {
  return (
    <PermissionGuard requiredPermission="core.restocking">
      <PurchaseOrderDetailPageContent />
    </PermissionGuard>
  )
}
