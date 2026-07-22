import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import * as XLSX from 'xlsx'

// ── Supported formats ─────────────────────────────────────────────────────────
// .csv  — plain CSV text
// .xlsx — Excel workbook (first sheet used)
// .xls  — Legacy Excel (first sheet used)
//
// Expected columns (row 1 = headers, rows starting with # are skipped):
//   type, name, size, quantity, buyingPrice
//   bottleSellingPrice (optional), lowStockThreshold (optional)
//   serving1Name, serving1Units, serving1Price  (repeat up to 6×)

const MAX_SERVINGS = 6

// ── Parse any uploaded file into a 2-D string array ───────────────────────────
async function parseFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase()
  const buffer = await file.arrayBuffer()

  if (name.endsWith('.csv')) {
    // Plain-text CSV — use our own parser so we don't need PapaParse on the server
    const text = new TextDecoder().decode(buffer)
    return parseCSVText(text)
  }

  // Excel — xlsx handles both .xlsx and .xls
  const workbook  = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet     = workbook.Sheets[sheetName]

  // Convert sheet to array-of-arrays; defval keeps empty cells as '' not undefined
  const rows: (string | number | boolean | null)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw:    false,   // format everything as strings (preserves numbers as "1240" etc.)
  })

  return rows.map(r => r.map(cell => String(cell ?? '').trim()))
}

// ── Minimal CSV parser (handles quoted fields containing commas) ──────────────
function parseCSVText(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const fields: string[] = []
    let current   = ''
    let inQuotes  = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    rows.push(fields)
  }
  return rows
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a .csv, .xlsx, or .xls file.' },
        { status: 400 }
      )
    }

    const rows = await parseFile(file)

    if (rows.length < 2) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 })
    }

    // Build header → index map (case-insensitive, trimmed)
    const rawHeaders = rows[0]
    const headerIndex: Record<string, number> = {}
    rawHeaders.forEach((h, i) => {
      headerIndex[h.toLowerCase().replace(/\s+/g, '')] = i
    })

    // Helper: get a cell value by column name
    function cell(row: string[], name: string): string {
      const idx = headerIndex[name.toLowerCase().replace(/\s+/g, '')]
      return idx !== undefined ? (row[idx] ?? '').trim() : ''
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    let imported = 0
    let servingsCreated = 0
    const errors: string[] = []
    const dataRows = rows.slice(1).filter(row => {
      // Skip description/comment rows (first cell starts with #)
      const first = (row[0] ?? '').trim()
      return first !== '' && !first.startsWith('#')
    })

    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx]
      const rowNum = rowIdx + 2 // 1-based, accounting for header

      try {
        // ── Required fields ──────────────────────────────────────────────────
        const typeName  = cell(row, 'type')
        const itemName  = cell(row, 'name')
        const size      = cell(row, 'size')
        const qtyRaw    = cell(row, 'quantity')
        const buyRaw    = cell(row, 'buyingprice')

        if (!typeName || !itemName || !size) {
          errors.push(`Row ${rowNum}: type, name, and size are required`)
          continue
        }
        if (!qtyRaw || !buyRaw) {
          errors.push(`Row ${rowNum}: quantity and buyingPrice are required`)
          continue
        }

        const quantity    = parseInt(qtyRaw.replace(/[^0-9]/g, '')) || 0
        const buyingPrice = parseFloat(buyRaw.replace(/[^0-9.]/g, '')) || 0
        const bottleSellingPrice = parseFloat(
          (cell(row, 'bottlesellingprice') || '0').replace(/[^0-9.]/g, '')
        )
        const lowStockThreshold = parseInt(
          (cell(row, 'lowstockthreshold') || '3').replace(/[^0-9]/g, '')
        ) || 3

        // ── Find or create brand (keyed by type/category name) ───────────────
        let brand = await models.BarBrand.findOne({
          userId: ownerId,
          name: new RegExp(`^${typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        })

        if (!brand) {
          brand = await models.BarBrand.create({
            userId:      ownerId,
            name:        typeName,
            category:    typeName,   // category mirrors type for bar brands
            description: '',
            isArchived:  false,
            createdAt:   new Date(),
            updatedAt:   new Date(),
          })
        }

        // ── Create the inventory item ────────────────────────────────────────
        const item = await models.BarInventoryItem.create({
          userId:             ownerId,
          brandId:            brand._id,
          name:               itemName,   // the 'name' column from the CSV (e.g. "Jameson")
          size,
          buyingPrice,
          bottleSellingPrice,
          stock:              quantity,
          lowStockThreshold,
          isActive:           true,
          createdAt:          new Date(),
          updatedAt:          new Date(),
        })

        imported++

        // Audit log
        await models.BarAuditLog.create({
          userId:        ownerId,
          staffId:       payload.userId,
          operation:     'INVENTORY_ADJUSTED',
          referenceId:   String(item._id),
          referenceType: 'BarInventoryItem',
          details: {
            action:      'imported',
            brandName:   typeName,
            itemName,
            size,
            buyingPrice,
            bottleSellingPrice,
            stock:       quantity,
          },
          timestamp: new Date(),
        })

        // ── Create servings ──────────────────────────────────────────────────
        for (let s = 1; s <= MAX_SERVINGS; s++) {
          const sName  = cell(row, `serving${s}name`)
          const sUnits = cell(row, `serving${s}units`)
          const sPrice = cell(row, `serving${s}price`)

          // Stop as soon as we hit a serving slot with no name
          if (!sName) break

          const units = parseInt(sUnits.replace(/[^0-9]/g, ''))
          const price = parseFloat(sPrice.replace(/[^0-9.]/g, ''))

          if (!units || units < 1) {
            errors.push(`Row ${rowNum} serving${s}: units must be a positive integer (got "${sUnits}")`)
            continue
          }
          if (isNaN(price) || price < 0) {
            errors.push(`Row ${rowNum} serving${s}: price is invalid (got "${sPrice}")`)
            continue
          }

          await models.BarServing.create({
            userId:          ownerId,
            inventoryItemId: item._id,
            name:            sName,
            unitsProduced:   units,
            sellingPrice:    price,
            isActive:        true,
            createdAt:       new Date(),
            updatedAt:       new Date(),
          })

          servingsCreated++
        }
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err.message}`)
      }
    }

    return NextResponse.json({
      imported,
      servingsCreated,
      total: dataRows.length,
      errors: errors.slice(0, 20),
    })
  } catch (error: any) {
    console.error('[bar/inventory-items/import]', error)
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 })
  }
}
