import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'

export async function POST(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(req)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'File is empty or invalid' }, { status: 400 })
    }

    // Parse CSV
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const inventoryItems = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const item: any = {}

      headers.forEach((header, index) => {
        const value = values[index] || ''
        
        switch (header) {
          case 'name':
            item.productName = value
            break
          case 'category':
            item.category = value || 'Restaurant Supplies'
            break
          case 'stock':
            item.stock = parseFloat(value) || 0
            break
          case 'unit':
            item.unit = value || 'kg'
            break
          case 'lowstockthreshold':
            item.lowStockThreshold = parseInt(value) || 10
            break
          case 'buyingprice':
            item.buyingPrice = parseFloat(value) || 0
            break
          case 'sellingprice':
            item.sellingPrice = parseFloat(value) || 0
            break
        }
      })

      if (item.productName && item.stock >= 0) {
        item.userId = ownerId
        // Set default prices if not provided
        if (!item.buyingPrice) item.buyingPrice = 0
        if (!item.sellingPrice) item.sellingPrice = item.buyingPrice * 1.3 // 30% markup default
        inventoryItems.push(item)
      }
    }

    if (inventoryItems.length === 0) {
      return NextResponse.json({ error: 'No valid inventory items found in file' }, { status: 400 })
    }

    // Insert all items
    await models.Product.insertMany(inventoryItems)

    return NextResponse.json({ 
      success: true, 
      imported: inventoryItems.length,
      message: `Successfully imported ${inventoryItems.length} inventory items`
    })
  } catch (err) {
    console.error('Inventory import error:', err)
    return NextResponse.json({ 
      error: 'Failed to import inventory',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}
