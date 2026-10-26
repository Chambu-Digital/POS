// CSV export utility for RFQs

export interface RFQCSVData {
  poNumber: string
  createdAt: string
  supplierName: string
  notes: string
  items: Array<{
    itemName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
}

/**
 * Generate a CSV string from an RFQ for download
 */
export function generateRFQCSV(rfq: RFQCSVData): string {
  const date = new Date(rfq.createdAt).toLocaleDateString()

  let csv = `Restock List\n`
  csv += `RFQ Number,${rfq.poNumber}\n`
  csv += `Date,${date}\n`
  csv += `\n`
  csv += `Item,Quantity,Unit Price,Line Total\n`

  for (const item of rfq.items) {
    const name = `"${(item.itemName || '').replace(/"/g, '""')}"`
    csv += `${name},${item.quantity},${item.unitPrice || 0},${item.lineTotal || 0}\n`
  }

  const total = rfq.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0)
  csv += `\nTotal,,,"${total}"\n`

  if (rfq.notes) {
    csv += `\nNotes,"${rfq.notes.replace(/"/g, '""')}"\n`
  }

  return csv
}

/**
 * Trigger a browser download of CSV content
 */
export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
