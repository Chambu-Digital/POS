// ─── POST /api/bar/sale ────────────────────────────────────────────────────────
// Legacy endpoint for direct bar sales. Now uses synthetic tab approach for
// unified bottle tracking.
//
// V2 Unified Bottle Tracking:
//   Creates a synthetic tab to ensure all serving sales flow through TabManager
//   for proper bottle tracking, audit logging, and timeline visibility.

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { TabManager } from '@/lib/bar/tab-manager'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, conn } = await getTenantDB(request)
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Create synthetic tab for unified bottle tracking
    const syntheticTab = await TabManager.createSyntheticDirectSaleTab(
      {
        userId:       ownerId,
        staffId:      payload.userId,
        customerName: data.customerName || 'Bar Sale',
        tableNumber:  'DIRECT',
        notes:        data.notes ?? `Bar tab ${data.tabNumber ?? ''}`,
      },
      conn
    )

    const tabId = String((syntheticTab as any)._id)

    // Add items via TabManager if they contain serving information
    const items = data.items as { name: string; quantity: number; price: number; inventoryItemId?: string; servingId?: string }[]
    
    for (const item of items) {
      if (item.inventoryItemId && item.servingId) {
        // Serving sale → go through TabManager for bottle tracking
        try {
          await TabManager.addLine(
            tabId,
            {
              inventoryItemId: item.inventoryItemId,
              servingId:       item.servingId,
              quantity:        item.quantity,
              staffId:         payload.userId,
              itemName:        item.name,
              servingName:     '', // Extract from serving if needed
              unitPrice:       item.price,
            },
            conn
          )
        } catch (addLineError) {
          console.error('[Bar] Failed to add line to synthetic tab:', addLineError)
        }
      }
      // Note: If no inventoryItemId/servingId, item is legacy format and won't have bottle tracking
    }

    // Close synthetic tab with payment
    await TabManager.closeSyntheticTab(
      tabId,
      {
        paymentMethod: data.paymentMethod || 'cash',
        amountPaid:    data.total,
        mpesaCode:     data.mpesaCode,
        mpesaPhone:    data.mpesaPhone,
        staffId:       payload.userId,
      },
      conn
    )

    // Create legacy Sale record for backward compatibility
    const saleItems = items.map(item => ({
      productId: item.inventoryItemId || '000000000000000000000001',
      productName: item.name,
      quantity: item.quantity,
      price: item.price,
      discount: 0,
    }))

    const sale = new models.Sale({
      userId: ownerId,
      staffId: payload.type === 'staff' ? payload.userId : null,
      items: saleItems,
      subtotal: data.subtotal,
      discount: data.discount ?? 0,
      total: data.total,
      paymentMethod: data.paymentMethod,
      mpesaCode: data.mpesaCode ?? null,
      mpesaPhone: data.mpesaPhone ?? null,
      notes: data.notes ?? `Bar tab ${data.tabNumber}`,
      source: 'bar',
      status: data.status ?? 'completed',
      synced: true,
    })
    await sale.save()

    return NextResponse.json({ sale, syntheticTabId: tabId }, { status: 201 })
  } catch (error) {
    console.error('[Bar] Sale POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save sale' },
      { status: 500 }
    )
  }
}

