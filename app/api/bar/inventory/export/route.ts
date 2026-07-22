import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)

    // Fetch all brands
    const brands = await models.BarBrand.find({ userId: payload.userId, isArchived: false })
      .sort({ name: 1 })

    // Fetch all inventory items
    const inventoryItems = await models.BarInventoryItem.find({ userId: payload.userId, isActive: true })
      .sort({ brandId: 1, size: 1 })

    // Fetch all servings
    const servings = await models.BarServing.find({ userId: payload.userId, isActive: true })

    // Build flattened inventory data
    const inventoryData: any[] = []

    // Add sample row as guide
    inventoryData.push({
      'Type': 'Whiskey',
      'Name': 'Jameson',
      'Bottle': '750ml',
      'Quantity': 6,
      'Price': 1240,
      'Buying Price': 1000,
      'Low Stock Threshold': 3,
      'Serving 1 Name': 'Half',
      'Serving 1 Price': 700,
      'Serving 1 Units': 2,
      'Serving 2 Name': 'Quarter',
      'Serving 2 Price': 350,
      'Serving 2 Units': 4,
      'Serving 3 Name': 'Tot',
      'Serving 3 Price': 50,
      'Serving 3 Units': 18,
    })

    for (const item of inventoryItems) {
      const brand = brands.find(b => b._id.toString() === item.brandId.toString())
      if (!brand) continue

      const itemServings = servings.filter(s => s.inventoryItemId.toString() === item._id.toString())

      // Create base row
      const row: any = {
        'Type': brand.category || '',
        'Name': brand.name,
        'Bottle': item.size,
        'Quantity': item.stock,
        'Price': item.bottleSellingPrice,
        'Buying Price': item.buyingPrice,
        'Low Stock Threshold': item.lowStockThreshold,
      }

      // Add servings (up to 5 servings per item)
      itemServings.forEach((serving, index) => {
        row[`Serving ${index + 1} Name`] = serving.name
        row[`Serving ${index + 1} Price`] = serving.sellingPrice
        row[`Serving ${index + 1} Units`] = serving.unitsProduced
      })

      inventoryData.push(row)
    }

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(inventoryData)

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Type
      { wch: 25 }, // Name
      { wch: 10 }, // Bottle
      { wch: 10 }, // Quantity
      { wch: 12 }, // Price
      { wch: 12 }, // Buying Price
      { wch: 18 }, // Low Stock Threshold
      { wch: 15 }, // Serving 1 Name
      { wch: 12 }, // Serving 1 Price
      { wch: 10 }, // Serving 1 Units
      { wch: 15 }, // Serving 2 Name
      { wch: 12 }, // Serving 2 Price
      { wch: 10 }, // Serving 2 Units
      { wch: 15 }, // Serving 3 Name
      { wch: 12 }, // Serving 3 Price
      { wch: 10 }, // Serving 3 Units
    ]
    worksheet['!cols'] = colWidths

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory')

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="bar-inventory-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('[bar/inventory/export] error:', error)
    return NextResponse.json({ error: 'Failed to export inventory' }, { status: 500 })
  }
}
