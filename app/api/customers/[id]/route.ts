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
    const { amount, note } = await request.json()

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })

    const customer = await models.Customer.findById(id)
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const payment = Math.min(amount, customer.creditBalance)
    customer.creditBalance -= payment
    customer.ledger.push({
      date: new Date(),
      type: 'payment',
      amount: -payment,
      balance: customer.creditBalance,
      note: note || 'Credit payment',
    })
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
