import { connectDB } from '@/lib/db'
import User from '@/lib/models/User'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

// Default settings shape — always merged with whatever is stored
function buildDefaults(user: { shopName?: string; email?: string; phone?: string; kraPin?: string }) {
  return {
    general: {
      shopName:     user.shopName || '',
      logo:         '',
      phone:        user.phone    || '',
      email:        user.email    || '',
      country:      '',
      address:      '',
      businessType: '',
      kraPin:       user.kraPin   || '',
      currency:     'KES',
      timezone:     'Africa/Nairobi',
      receiptFooter:'Thank you for your business!',
    },
    features: {
      taxEnabled:          true,
      taxRate:             16,
      termsEnabled:        false,
      termsText:           '',
      discountsEnabled:    true,
      kdsEnabled:          true,
      kdsRestaurantName:   '',
      kdsTableCount:       10,
      shiftsEnabled:       false,
      barEnabled:          true,
    },
    notifications: {
      emailNotifications:   true,
      smsNotifications:     false,
      lowStockAlerts:       true,
      dailySalesReport:     false,
      newOrderNotification: true,
    },
    payment: {
      enableCash:          true,
      enableCard:          false,
      enableMpesa:         true,
      mpesaPaybill:        '',
      mpesaAccountNumber:  '',
    },
    receipt: {
      showLogo:      true,
      showTaxId:     true,
      showAddress:   true,
      showPhone:     true,
      customMessage: 'Thank You For Shopping With Us!',
      paperSize:     'A4',
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    // Staff members read their admin's settings
    const userId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const user = await User.findById(userId).lean() as {
      shopName?: string; email?: string; phone?: string; kraPin?: string
      settings?: Record<string, unknown>
    } | null
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const defaults = buildDefaults(user)
    const stored   = (user.settings || {}) as Record<string, unknown>

    // Deep-merge: stored non-empty values win, missing/empty keys fall back to defaults
    function mergeSection<T extends object>(def: T, saved: Partial<T> = {}): T {
      const result = { ...def }
      for (const key of Object.keys(saved) as (keyof T)[]) {
        const v = saved[key]
        // Only override default if stored value is meaningfully set
        if (v !== undefined && v !== null && v !== '') {
          result[key] = v as T[keyof T]
        }
      }
      return result
    }

    const settings = {
      general:       mergeSection(defaults.general,       (stored.general       || stored.shop || {}) as object),
      features:      mergeSection(defaults.features,      (stored.features      || {}) as object),
      notifications: mergeSection(defaults.notifications, (stored.notifications || {}) as object),
      payment:       mergeSection(defaults.payment,       (stored.payment       || {}) as object),
      receipt:       mergeSection(defaults.receipt,       (stored.receipt       || {}) as object),
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[Settings] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (payload.type !== 'user') return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    await connectDB()
    const body = await request.json()

    // Persist under the new unified key shape
    const user = await User.findByIdAndUpdate(
      payload.userId,
      {
        $set: {
          settings:  body,
          // Keep top-level shopName in sync
          shopName: body.general?.shopName || body.shop?.shopName || undefined,
        },
      },
      { new: true }
    ).lean() as { settings?: unknown } | null

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({ message: 'Settings saved', settings: user.settings })
  } catch (error) {
    console.error('[Settings] PUT error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
