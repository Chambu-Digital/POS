import { connectDB } from '@/lib/db'
import User from '@/lib/models/User'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin/owner can access settings
    if (payload.type !== 'user') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await connectDB()

    const user = await User.findById(payload.userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Return settings or defaults
    const settings = user.settings || {
      shop: {
        shopName: user.shopName || '',
        email: user.email || '',
        phone: '',
        address: '',
        taxId: '',
        currency: 'KES',
        timezone: 'Africa/Nairobi',
        receiptFooter: 'Thank you for your business!',
      },
      notifications: {
        emailNotifications: true,
        smsNotifications: false,
        lowStockAlerts: true,
        dailySalesReport: false,
        newOrderNotification: true,
      },
      payment: {
        enableCash: true,
        enableCard: false,
        enableMpesa: true,
        mpesaPaybill: '522522',
        mpesaAccountNumber: '7716828',
        taxRate: 16,
      },
      receipt: {
        showLogo: true,
        showTaxId: true,
        showAddress: true,
        showPhone: true,
        customMessage: 'Thank You For Shopping With Us!',
        paperSize: 'A4',
      },
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[Settings] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin/owner can update settings
    if (payload.type !== 'user') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await connectDB()

    const data = await request.json()

    const user = await User.findByIdAndUpdate(
      payload.userId,
      {
        $set: {
          settings: data,
          shopName: data.shop?.shopName || undefined,
        },
      },
      { new: true }
    )

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Settings updated successfully',
      settings: user.settings,
    })
  } catch (error) {
    console.error('[Settings] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
