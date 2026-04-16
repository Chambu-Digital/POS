import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const formData = await request.formData()
    const file = formData.get('file') as File
    const mappingStr = formData.get('mapping') as string

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    let mapping: Record<string, string> = {}
    if (mappingStr) {
      try { mapping = JSON.parse(mappingStr) } catch { return NextResponse.json({ error: 'Invalid mapping format' }, { status: 400 }) }
    }

    const fileName = file.name.toLowerCase()
    let rows: Record<string, any>[] = []

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
      if (!jsonData.length) return NextResponse.json({ error: 'Excel file is empty' }, { status: 400 })
      const headers = jsonData[0].map((h: any) => String(h || ''))
      rows = jsonData.slice(1).map(row => {
        const obj: Record<string, any> = {}
        headers.forEach((h: string, i: number) => { obj[h] = row[i] !== undefined ? String(row[i]) : '' })
        return obj
      })
    } else {
      await new Promise<void>((resolve, reject) => {
        Papa.parse(await file.text() as any, {
          header: true, skipEmptyLines: true,
          complete: (r) => { rows = r.data as any[]; resolve() },
          error: reject,
        })
      })
    }

    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const products = rows.map(row => {
      const p: Record<string, any> = { userId: ownerId }
      Object.entries(mapping).forEach(([col, field]) => {
        if (field && field !== 'skip' && row[col] !== undefined && row[col] !== '') {
          p[field] = ['buyingPrice','sellingPrice','wholeSale','stock'].includes(field) ? parseFloat(row[col]) || 0 : row[col]
        }
      })
      return p
    })

    const valid = products.filter(p => p.productName && p.category && p.buyingPrice !== undefined && p.sellingPrice !== undefined && p.stock !== undefined)
    if (!valid.length) return NextResponse.json({ error: 'No valid products found after mapping' }, { status: 400 })

    const uniqueCategories = [...new Set(valid.map(p => p.category))]
    const createdCategories: string[] = []
    for (const name of uniqueCategories) {
      const existing = await models.Category.findOne({ userId: ownerId, name })
      if (!existing) { await models.Category.create({ userId: ownerId, name, description: 'Auto-created from import', productCount: 0 }); createdCategories.push(name) }
    }

    const dupeCheck = await models.Product.find({ userId: ownerId, $or: valid.map(p => ({ productName: p.productName, category: p.category })) })
    const dupeKeys = new Set(dupeCheck.map((p: any) => `${p.productName}|${p.category}`))
    const newProducts = valid.filter(p => !dupeKeys.has(`${p.productName}|${p.category}`))
    const duplicates = valid.filter(p => dupeKeys.has(`${p.productName}|${p.category}`))

    let inserted: any[] = []
    if (newProducts.length) inserted = await models.Product.insertMany(newProducts)

    for (const name of uniqueCategories) {
      const count = await models.Product.countDocuments({ userId: ownerId, category: name })
      await models.Category.findOneAndUpdate({ userId: ownerId, name }, { productCount: count })
    }

    return NextResponse.json({
      message: `Successfully imported ${inserted.length} products`,
      count: inserted.length, products: inserted,
      duplicatesSkipped: duplicates.length, categoriesCreated: createdCategories.length, newCategories: createdCategories,
      stats: { total: valid.length, imported: inserted.length, duplicates: duplicates.length, categoriesCreated: createdCategories.length },
    }, { status: 201 })
  } catch (error) {
    console.error('[import] POST error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
