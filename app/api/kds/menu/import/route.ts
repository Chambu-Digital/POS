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
    const menuItems = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const item: any = {}

      headers.forEach((header, index) => {
        const value = values[index] || ''
        
        switch (header) {
          case 'name':
            item.name = value
            break
          case 'description':
            item.description = value
            break
          case 'category':
            item.category = ['starter', 'main', 'side', 'dessert', 'drink'].includes(value.toLowerCase()) 
              ? value.toLowerCase() 
              : 'main'
            break
          case 'price':
            item.price = parseFloat(value) || 0
            break
          case 'preptime':
            item.prepTime = parseInt(value) || 15
            break
          case 'station':
            item.station = ['grill', 'drinks', 'dessert', 'pizza', 'all'].includes(value.toLowerCase())
              ? value.toLowerCase()
              : 'all'
            break
          case 'vegetarian':
            item.vegetarian = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true'
            break
          case 'vegan':
            item.vegan = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true'
            break
          case 'glutenfree':
            item.glutenFree = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true'
            break
          case 'spicylevel':
            const level = parseInt(value) || 0
            item.spicyLevel = Math.min(Math.max(level, 0), 5)
            break
        }
      })

      if (item.name && item.price > 0) {
        item.userId = ownerId
        item.available = true
        item.popular = false
        menuItems.push(item)
      }
    }

    if (menuItems.length === 0) {
      return NextResponse.json({ error: 'No valid menu items found in file' }, { status: 400 })
    }

    // Insert all items
    await models.MenuItem.insertMany(menuItems)

    return NextResponse.json({ 
      success: true, 
      imported: menuItems.length,
      message: `Successfully imported ${menuItems.length} menu items`
    })
  } catch (err) {
    console.error('Menu import error:', err)
    return NextResponse.json({ 
      error: 'Failed to import menu',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}
