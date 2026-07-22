import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet) as any[]

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 })
    }

    const { models } = await getTenantDB(request)

    let created = 0
    let updated = 0
    const errors: string[] = []

    for (const row of data) {
      try {
        // Validate required fields
        if (!row['Name'] || !row['Bottle']) {
          errors.push(`Row missing required fields: Name and Bottle`)
          continue
        }

        // Find or create brand
        let brand = await models.BarBrand.findOne({
          userId: payload.userId,
          name: row['Name'],
        })

        if (!brand) {
          brand = new models.BarBrand({
            userId: payload.userId,
            name: row['Name'],
            category: row['Type'] || '',
            description: '',
            isArchived: false,
          })
          await brand.save()
        } else {
          // Update category if provided
          if (row['Type']) {
            brand.category = row['Type']
            await brand.save()
          }
        }

        // Find or create inventory item
        let inventoryItem = await models.BarInventoryItem.findOne({
          userId: payload.userId,
          brandId: brand._id,
          size: row['Bottle'],
        })

        if (!inventoryItem) {
          inventoryItem = new models.BarInventoryItem({
            userId: payload.userId,
            brandId: brand._id,
            size: row['Bottle'],
            buyingPrice: row['Buying Price'] || 0,
            bottleSellingPrice: row['Price'] || 0,
            stock: row['Quantity'] || 0,
            lowStockThreshold: row['Low Stock Threshold'] || 3,
            isActive: true,
          })
          await inventoryItem.save()
          created++
        } else {
          // Update existing inventory item
          if (row['Buying Price'] !== undefined) inventoryItem.buyingPrice = row['Buying Price']
          if (row['Price'] !== undefined) inventoryItem.bottleSellingPrice = row['Price']
          if (row['Quantity'] !== undefined) inventoryItem.stock = row['Quantity']
          if (row['Low Stock Threshold'] !== undefined) inventoryItem.lowStockThreshold = row['Low Stock Threshold']
          await inventoryItem.save()
          updated++
        }

        // Handle servings (up to 5 servings)
        for (let i = 1; i <= 5; i++) {
          const servingName = row[`Serving ${i} Name`]
          const servingPrice = row[`Serving ${i} Price`]
          const servingUnits = row[`Serving ${i} Units`]

          if (!servingName) continue

          // Find or create serving
          let serving = await models.BarServing.findOne({
            userId: payload.userId,
            inventoryItemId: inventoryItem._id,
            name: servingName,
          })

          if (!serving) {
            serving = new models.BarServing({
              userId: payload.userId,
              inventoryItemId: inventoryItem._id,
              name: servingName,
              sellingPrice: servingPrice || 0,
              unitsProduced: servingUnits || 1,
              isActive: true,
            })
            await serving.save()
          } else {
            // Update existing serving
            if (servingPrice !== undefined) serving.sellingPrice = servingPrice
            if (servingUnits !== undefined) serving.unitsProduced = servingUnits
            await serving.save()
          }
        }
      } catch (err: any) {
        errors.push(`Error processing row for ${row['Name']}: ${err.message}`)
      }
    }

    return NextResponse.json({
      message: 'Import completed',
      created,
      updated,
      errors,
      total: data.length,
    })
  } catch (error) {
    console.error('[bar/inventory/import] error:', error)
    return NextResponse.json({ error: 'Failed to import inventory' }, { status: 500 })
  }
}
