import { NextRequest, NextResponse } from 'next/server'
import { initiateSTKPush } from '@/lib/mpesa'
import { getAuthPayload } from '@/lib/jwt'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { phoneNumber, amount, orderReference } = await request.json()

    if (!phoneNumber || !amount) {
      return NextResponse.json(
        { error: 'Phone number and amount are required' },
        { status: 400 }
      )
    }

    const result = await initiateSTKPush(
      phoneNumber,
      amount,
      orderReference || 'ORDER',
      'Payment for order'
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[M-Pesa] STK Push error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate STK Push' },
      { status: 500 }
    )
  }
}
