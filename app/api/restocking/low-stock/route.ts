import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const modules = searchParams.get('modules')?.split(',') || ['retail']

    // Aggregate low stock items from all requested modules
    const allItems: any[] = []

    // Fetch from retail if requested
    if (modules.includes('retail')) {
      try {
        const retailResponse = await fetch(
          `${request.nextUrl.origin}/api/retail/restocking/low-stock`,
          { headers: request.headers }
        )
        if (retailResponse.ok) {
          const data = await retailResponse.json()
          const retailItems = data.items.map((item: any) => ({
            ...item,
            module: 'retail'
          }))
          allItems.push(...retailItems)
        }
      } catch (error) {
        console.error('Failed to fetch retail low stock:', error)
      }
    }

    // TODO: Add bar module
    // if (modules.includes('bar')) { ... }

    // TODO: Add pharmacy module
    // if (modules.includes('pharmacy')) { ... }

    // Calculate statistics
    const critical = allItems.filter(item => {
      const deficit = item.lowStockThreshold - item.currentStock
      return deficit > (item.lowStockThreshold * 0.5) // >50% below threshold
    }).length

    const low = allItems.length - critical

    return NextResponse.json({
      items: allItems,
      stats: {
        total: allItems.length,
        critical,
        low,
        estimatedCost: allItems.reduce((sum, item) => {
          const deficit = Math.max(0, item.lowStockThreshold - item.currentStock)
          return sum + (deficit * item.buyingPrice)
        }, 0)
      }
    })
  } catch (error: any) {
    console.error('Restocking low stock error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch low stock items', details: error.message },
      { status: 500 }
    )
  }
}
