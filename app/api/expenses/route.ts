import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)
    
    const url = new URL(request.url)
    const search = url.searchParams.get('search') || ''
    const status = url.searchParams.get('status') || ''
    const branchId = url.searchParams.get('branchId') || ''

    const query: Record<string, unknown> = { userId: ownerId }
    
    // Filter by branch
    if (branchId) {
      query.branchId = branchId
    } else if (branchContext) {
      // Auto-filter by user's current branch context
      query.branchId = branchContext
    }
    
    // Filter by status
    if (status) {
      query.status = status
    }
    
    // Search in title
    if (search) {
      query.title = { $regex: search, $options: 'i' }
    }

    const expenses = await models.Expense.find(query).sort({ createdAt: -1 })
    return NextResponse.json({ expenses })
  } catch (error) {
    console.error('[expenses] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)
    const data = await request.json()

    // Validate payment method if payment details are provided
    if (data.paymentMethod && !['cash', 'card', 'mobile_money', 'bank', 'custom'].includes(data.paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    // If paid immediately, set paidBy and paymentDate
    const isPaidNow = data.paymentMethod && data.paymentMethod !== ''
    
    const expense = new models.Expense({
      ...data,
      userId: ownerId,
      branchId: data.branchId || branchContext || null, // Use provided branch or current context
      staffId: payload.type === 'staff' ? payload.userId : undefined, // Who logged it
      paidBy: isPaidNow ? (payload.type === 'staff' ? payload.userId : null) : undefined, // Who paid (null = owner)
      paymentDate: isPaidNow ? (data.paymentDate || new Date()) : undefined,
      // Payment method details
      paymentMethod: data.paymentMethod || '',
      receiptNumber: data.receiptNumber || '',
      bankProviderId: data.bankProviderId || undefined,
      bankProviderName: data.bankProviderName || '',
      customMethodId: data.customMethodId || undefined,
      customMethodName: data.customMethodName || '',
      mpesaCode: data.mpesaCode || '',
      mpesaPhone: data.mpesaPhone || '',
    })
    
    await expense.save()
    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('[expenses] POST error:', error)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
