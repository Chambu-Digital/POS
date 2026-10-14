'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { FileText, Send, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'

interface Customer {
  _id: string
  name: string
  phone: string
  email?: string
  creditBalance: number
}

interface UnpaidSale {
  _id: string
  orderNumber: string
  total: number
  debt: number
  paymentStatus: 'unpaid' | 'partial'
  createdAt: string
  items: Array<{
    productName: string
    quantity: number
    price: number
  }>
}

interface CustomerInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  shopName?: string
}

export function CustomerInvoiceDialog({
  open,
  onOpenChange,
  customer,
  shopName = 'Our Shop'
}: CustomerInvoiceDialogProps) {
  const [loading, setLoading] = useState(false)
  const [unpaidSales, setUnpaidSales] = useState<UnpaidSale[]>([])
  const [sending, setSending] = useState(false)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (open && customer) {
      fetchUnpaidSales()
    }
  }, [open, customer])

  async function fetchUnpaidSales() {
    if (!customer) return

    setLoading(true)
    try {
      // Fetch customer details with full ledger
      const customerResponse = await fetch(`/api/customers`)
      if (!customerResponse.ok) {
        toast.error('Failed to load customer data')
        setLoading(false)
        return
      }
      
      const customersData = await customerResponse.json()
      const fullCustomer = customersData.customers?.find((c: any) => c._id === customer._id)
      
      if (!fullCustomer || !fullCustomer.ledger) {
        toast.error('Customer ledger not found')
        setLoading(false)
        return
      }

      // Find the last point where balance was zero (debt fully cleared)
      let lastZeroBalanceIndex = -1
      for (let i = fullCustomer.ledger.length - 1; i >= 0; i--) {
        if (fullCustomer.ledger[i].balance === 0) {
          lastZeroBalanceIndex = i
          break
        }
      }

      // Get all purchase entries after last zero balance (current debt cycle)
      const unpaidPurchases = fullCustomer.ledger
        .slice(lastZeroBalanceIndex + 1)
        .filter((entry: any) => entry.type === 'purchase' && entry.saleId)

      if (unpaidPurchases.length === 0) {
        setUnpaidSales([])
        setLoading(false)
        return
      }

      // Fetch all sales by their IDs
      const saleIds = unpaidPurchases.map((p: any) => p.saleId).filter(Boolean)
      const salesPromises = saleIds.map((id: string) =>
        fetch(`/api/sales/${id}`).then(r => r.ok ? r.json() : null)
      )
      
      const salesResults = await Promise.all(salesPromises)
      const sales = salesResults.filter(Boolean)

      // Map ledger amounts to sales for accurate debt display
      const salesWithLedgerDebt = sales.map((sale: any) => {
        const ledgerEntry = unpaidPurchases.find((p: any) => p.saleId === sale._id)
        return {
          ...sale,
          // Use ledger amount as the debt (this is what was added to balance)
          debt: ledgerEntry?.amount || sale.debt || 0,
          ledgerAmount: ledgerEntry?.amount || 0,
        }
      })

      setUnpaidSales(salesWithLedgerDebt)
    } catch (error) {
      console.error('Error fetching unpaid sales:', error)
      toast.error('Failed to load unpaid orders')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  function formatPhone(raw: string) {
    if (!raw) return ''
    const digits = raw.replace(/\D/g, '')
    // Convert 07xx or 01xx → 2547xx / 2541xx
    if (digits.startsWith('0') && digits.length === 10) {
      return '254' + digits.slice(1)
    }
    return digits
  }

  function handleSendViaWhatsApp() {
    if (!customer || !customer.phone) {
      toast.error('Customer phone number is missing')
      return
    }

    setSending(true)

    // Build invoice message
    let message = `*PAYMENT REMINDER*\n`
    message += `From: ${shopName}\n\n`
    message += `Dear ${customer.name},\n\n`
    message += `Outstanding Balance: *KES ${customer.creditBalance.toLocaleString()}*\n\n`

    if (unpaidSales.length > 0) {
      message += `*Unpaid Orders:*\n`
      unpaidSales.forEach((sale) => {
        message += `\n• Order ${sale.orderNumber}\n`
        message += `  Date: ${formatDate(sale.createdAt)}\n`
        message += `  Total: KES ${sale.total.toLocaleString()}\n`
        
        // Show payment info if partial
        if (sale.total > sale.debt && sale.debt > 0) {
          message += `  Paid: KES ${(sale.total - sale.debt).toLocaleString()}\n`
          message += `  Balance: KES ${sale.debt.toLocaleString()}\n`
        } else {
          message += `  Amount Due: KES ${sale.debt.toLocaleString()}\n`
        }
      })
      message += `\n`
      message += `─────────────────\n`
      message += `*Total Outstanding: KES ${customer.creditBalance.toLocaleString()}*\n\n`
    }

    message += `Please settle your balance at your earliest convenience.\n\n`
    message += `For payments or inquiries, contact us.\n\n`
    message += `Thank you for your business!\n`
    message += `Powered by Chambu Digital`

    const whatsappUrl = `https://wa.me/${formatPhone(customer.phone)}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')

    setSending(false)
    toast.success('WhatsApp opened with invoice')
    
    // Close dialog after short delay
    setTimeout(() => {
      onOpenChange(false)
    }, 500)
  }

  function handlePrintInvoice() {
    if (!customer) return

    setPrinting(true)

    // Build HTML invoice
    const invoiceHTML = `
      <html>
        <head>
          <title>Invoice - ${customer.name}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #2563eb;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              color: #2563eb;
              font-size: 32px;
            }
            .header .shop-name {
              font-size: 20px;
              color: #666;
              margin-top: 5px;
            }
            .customer-info {
              background: #f3f4f6;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .customer-info h3 {
              margin-top: 0;
              color: #1f2937;
            }
            .balance-box {
              background: #fee2e2;
              border: 2px solid #dc2626;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              margin-bottom: 30px;
            }
            .balance-box .label {
              font-size: 14px;
              color: #991b1b;
              margin-bottom: 5px;
            }
            .balance-box .amount {
              font-size: 36px;
              font-weight: bold;
              color: #dc2626;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            th {
              background: #2563eb;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: 600;
            }
            td {
              padding: 12px;
              border-bottom: 1px solid #e5e7eb;
            }
            tr:hover {
              background: #f9fafb;
            }
            .total-row {
              background: #f3f4f6;
              font-weight: bold;
              font-size: 18px;
            }
            .footer {
              text-align: center;
              margin-top: 50px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 600;
            }
            .status-unpaid {
              background: #fee2e2;
              color: #991b1b;
            }
            .status-partial {
              background: #fef3c7;
              color: #92400e;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PAYMENT INVOICE</h1>
            <div class="shop-name">${shopName}</div>
            <div style="margin-top: 10px; font-size: 14px;">Date: ${new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          </div>

          <div class="customer-info">
            <h3>Bill To:</h3>
            <p><strong>${customer.name}</strong></p>
            ${customer.phone ? `<p>Phone: ${customer.phone}</p>` : ''}
            ${customer.email ? `<p>Email: ${customer.email}</p>` : ''}
          </div>

          <div class="balance-box">
            <div class="label">Total Outstanding Balance</div>
            <div class="amount">KES ${customer.creditBalance.toLocaleString()}</div>
          </div>

          <h3 style="margin-bottom: 15px;">Unpaid Orders</h3>
          ${unpaidSales.length === 0 ? `
            <p style="text-align: center; padding: 40px; color: #6b7280;">No unpaid orders found</p>
          ` : `
            <table>
              <thead>
                <tr>
                  <th>Order No.</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${unpaidSales.map(sale => `
                  <tr>
                    <td><strong>${sale.orderNumber}</strong></td>
                    <td>${formatDate(sale.createdAt)}</td>
                    <td>KES ${sale.total.toLocaleString()}</td>
                    <td>KES ${(sale.total - sale.debt).toLocaleString()}</td>
                    <td><strong>KES ${sale.debt.toLocaleString()}</strong></td>
                    <td>
                      ${sale.total > sale.debt && sale.debt > 0 
                        ? '<span class="status-badge status-partial">Partial</span>' 
                        : '<span class="status-badge status-unpaid">Unpaid</span>'}
                    </td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="4" style="text-align: right;">TOTAL DUE:</td>
                  <td colspan="2"><strong>KES ${customer.creditBalance.toLocaleString()}</strong></td>
                </tr>
              </tbody>
            </table>
          `}

          <div class="footer">
            <p>Please settle your balance at your earliest convenience.</p>
            <p>For payments or inquiries, please contact us.</p>
            <p style="margin-top: 20px;">Thank you for your business!</p>
            <p style="margin-top: 10px; font-size: 12px;">Powered by Chambu Digital</p>
          </div>
        </body>
      </html>
    `

    // Open print window
    const printWindow = window.open('', '', 'width=800,height=600')
    if (printWindow) {
      printWindow.document.write(invoiceHTML)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
        setPrinting(false)
      }, 250)
    } else {
      toast.error('Failed to open print window')
      setPrinting(false)
    }
  }

  if (!customer) return null

  const totalDue = unpaidSales.reduce((sum, sale) => sum + sale.debt, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice for {customer.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Customer:</span>
                <p className="font-semibold">{customer.name}</p>
              </div>
              <div>
                <span className="text-gray-600">Phone:</span>
                <p className="font-semibold">{customer.phone || 'N/A'}</p>
              </div>
              {customer.email && (
                <div className="col-span-2">
                  <span className="text-gray-600">Email:</span>
                  <p className="font-semibold">{customer.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Outstanding Balance */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 font-medium">Total Outstanding Balance:</span>
              <span className="text-2xl font-bold text-red-600">
                KES {customer.creditBalance.toLocaleString()}
              </span>
            </div>
          </div>

          <Separator />

          {/* Unpaid Orders List */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Unpaid Orders</h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : unpaidSales.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No unpaid orders found</p>
                <p className="text-xs mt-1">Balance may be from adjustments or payments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {unpaidSales.map((sale) => (
                  <div
                    key={sale._id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          Order {sale.orderNumber}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(sale.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Amount Due</p>
                        <p className="text-lg font-bold text-red-600">
                          KES {sale.debt.toLocaleString()}
                        </p>
                        {sale.total > sale.debt && sale.debt > 0 ? (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                            Partial (Paid: KES {(sale.total - sale.debt).toLocaleString()})
                          </span>
                        ) : (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            Unpaid
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-1">
                      {sale.items.slice(0, 3).map((item, idx) => (
                        <p key={idx} className="text-xs text-gray-600">
                          • {item.productName} ({item.quantity}x)
                        </p>
                      ))}
                      {sale.items.length > 3 && (
                        <p className="text-xs text-gray-500 italic">
                          +{sale.items.length - 3} more items
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between text-lg">
              <span className="font-semibold">Total Due:</span>
              <span className="font-bold text-red-600">
                KES {customer.creditBalance.toLocaleString()}
              </span>
            </div>
            {unpaidSales.length > 0 && totalDue !== customer.creditBalance && (
              <p className="text-xs text-gray-500 mt-2">
                * Balance includes {unpaidSales.length} unpaid order(s) and may include adjustments
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handlePrintInvoice}
              disabled={printing}
            >
              <Printer className="h-4 w-4 mr-2" />
              {printing ? 'Printing...' : 'Print Invoice'}
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSendViaWhatsApp}
              disabled={sending || !customer.phone}
            >
              <Send className="h-4 w-4 mr-2" />
              {sending ? 'Sending...' : 'Send via WhatsApp'}
            </Button>
          </div>

          {!customer.phone && (
            <p className="text-xs text-amber-600 text-center">
              Customer phone number is required to send invoice via WhatsApp
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
