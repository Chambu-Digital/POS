import { connectDB } from '@/lib/db'
import Product from '@/lib/models/Product'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const mappingStr = formData.get('mapping') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Parse mapping
    let mapping: Record<string, string> = {}
    if (mappingStr) {
      try {
        mapping = JSON.parse(mappingStr)
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid mapping format' },
          { status: 400 }
        )
      }
    }

    // Read file
    const fileName = file.name.toLowerCase()
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    
    let rows: Record<string, any>[] = []

    if (isExcel) {
      // Parse Excel file
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      // Get first sheet
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      // Convert to JSON with headers
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      
      if (jsonData.length === 0) {
        return NextResponse.json(
          { error: 'Excel file is empty' },
          { status: 400 }
        )
      }

      // First row is headers
      const headers = (jsonData[0] as any[]).map(h => String(h || ''))
      
      // Convert remaining rows to objects
      rows = jsonData.slice(1).map((row: any) => {
        const obj: Record<string, any> = {}
        headers.forEach((header, index) => {
          obj[header] = row[index] !== undefined ? String(row[index]) : ''
        })
        return obj
      })
    } else {
      // Parse CSV file
      const text = await file.text()
      
      await new Promise<void>((resolve, reject) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            rows = results.data as Record<string, any>[]
            resolve()
          },
          error: (error) => {
            console.error('[v0] CSV parse error:', error)
            reject(error)
          },
        })
      })
    }

    // Apply mapping
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    
    const products = rows.map((row) => {
      const product: Record<string, any> = {
        userId: ownerId,
      }

      Object.entries(mapping).forEach(([csvCol, dbField]) => {
        if (dbField && dbField !== 'skip' && row[csvCol] !== undefined && row[csvCol] !== '') {
          if (['buyingPrice', 'sellingPrice', 'wholeSale', 'stock'].includes(dbField)) {
            product[dbField] = parseFloat(row[csvCol]) || 0
          } else {
            product[dbField] = row[csvCol]
          }
        }
      })

      return product
    })

    // Validate and filter
    const validProducts = products.filter((p) => {
      return (
        p.productName &&
        p.category &&
        p.buyingPrice !== undefined &&
        p.sellingPrice !== undefined &&
        p.stock !== undefined
      )
    })

    if (validProducts.length === 0) {
      return NextResponse.json(
        { error: 'No valid products found after mapping' },
        { status: 400 }
      )
    }

    // Insert into database
    const insertedProducts = await Product.insertMany(validProducts)

    return NextResponse.json(
      {
        message: `Successfully imported ${insertedProducts.length} products`,
        count: insertedProducts.length,
        products: insertedProducts,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[v0] Import POST error:', error)
    return NextResponse.json(
      { error: 'Import failed' },
      { status: 500 }
    )
  }
}
