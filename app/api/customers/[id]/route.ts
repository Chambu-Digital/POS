import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

// Pay off credit balance
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { id } = await params
    const { amount, note, paymentMethod, mpesaCode, mpesaPhone, bankProviderId, bankProviderName, customMethodId, customMethodName } = await request.json()

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    
    // Require payment method
    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    }

    const customer = await models.Customer.findById(id)
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const payment = Math.min(amount, customer.creditBalance)
    customer.creditBalance -= payment
    
    // Build note with payment method
    let paymentNote = note || 'Credit payment'
    if (paymentMethod === 'mobile_money' && mpesaCode) {
      paymentNote += ` (M-Pesa: ${mpesaCode})`
    } else if (paymentMethod === 'bank' && bankProviderName) {
      paymentNote += ` (${bankProviderName})`
    } else if (paymentMethod === 'custom' && customMethodName) {
      paymentNote += ` (${customMethodName})`
    } else if (paymentMethod === 'cash') {
      paymentNote += ' (Cash)'
    } else if (paymentMethod === 'card') {
      paymentNote += ' (Card)'
    }
    
    customer.ledger.push({
      date: new Date(),
      type: 'payment',
      amount: -payment,
      balance: customer.creditBalance,
      note: paymentNote,
      // Store payment method details for reporting
      paymentMethod,
      mpesaCode: mpesaCode || undefined,
      mpesaPhone: mpesaPhone || undefined,
      bankProviderId: bankProviderId || undefined,
      bankProviderName: bankProviderName || undefined,
      customMethodId: customMethodId || undefined,
      customMethodName: customMethodName || undefined,
    } as any)
    await customer.save()

    return NextResponse.json({ customer, paid: payment })
  } catch (error) {
    console.error('[customers/pay] POST error:', error)
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { id } = await params
    const data = await request.json()

    const customer = await models.Customer.findByIdAndUpdate(id, { $set: data }, { new: true })
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ customer })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { id } = await params
    const data = await request.json()

    const customer = await models.Customer.findByIdAndUpdate(id, { $set: data }, { new: true })
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ customer })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { id } = await params
    await models.Customer.findByIdAndDelete(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 })
  }
}
