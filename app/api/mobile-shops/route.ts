// ─── Mobile Shops API ───────────────────────────────────────────────────────────
// GET  /api/mobile-shops - List all mobile shops (active and closed)
// POST /api/mobile-shops - Deploy a new mobile shop

import { NextRequest, NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/jwt'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getModels } from '@/lib/tenant/get-models'
import mongoose from 'mongoose'
import { generateTempUsername, generateTempPIN } from '@/lib/temp-seller-credentials'

// ── GET /api/mobile-shops ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') // 'active', 'closed', or null for all

    const { conn } = await getTenantDB(req)
    const { MobileShop, Branch } = getModels(conn)

    const query: any = { userId: new mongoose.Types.ObjectId(ownerId) }
    if (status) {
      query.status = status
    }

    const shops = await MobileShop.find(query)
      .populate('sourceBranchId', 'name code')
      .populate('sellers', 'name email isTemporary')
      .populate('closedBy', 'name')
      .sort({ deployedAt: -1 })
      .lean()

    return NextResponse.json({ shops })
  } catch (error: any) {
    console.error('[mobile-shops] GET error:', error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

// ── POST /api/mobile-shops ─────────────────────────────────────────────────────
// Deploy a new mobile shop with stock and temp sellers
export async function POST(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const body = await req.json()
    const {
      name,
      sourceBranchId,
      stockOut, // [{ productId, productName, quantity }]
      tempSellers, // [{ name, email, phone }]
      notes,
    } = body

    // Validate
    if (!name || !sourceBranchId || !stockOut?.length) {
      return NextResponse.json(
        { message: 'Missing required fields: name, sourceBranchId, stockOut' },
        { status: 400 }
      )
    }

    const { conn } = await getTenantDB(req)
    const { MobileShop, Staff, ProductInventory, Branch } = getModels(conn)

    // Verify branch exists
    const branch = await Branch.findOne({
      _id: new mongoose.Types.ObjectId(sourceBranchId),
      userId: new mongoose.Types.ObjectId(ownerId),
    })
    if (!branch) {
      return NextResponse.json({ message: 'Source branch not found' }, { status: 404 })
    }

    // Verify stock availability and deduct from source branch
    const stockOutData = []
    for (const item of stockOut) {
      const inventory = await ProductInventory.findOne({
        userId: new mongoose.Types.ObjectId(ownerId),
        branchId: new mongoose.Types.ObjectId(sourceBranchId),
        productId: new mongoose.Types.ObjectId(item.productId),
      })

      if (!inventory || inventory.stock < item.quantity) {
        return NextResponse.json(
          { message: `Insufficient stock for ${item.productName}` },
          { status: 400 }
        )
      }

      // Deduct stock
      inventory.stock -= item.quantity
      await inventory.save()

      stockOutData.push({
        productId: new mongoose.Types.ObjectId(item.productId),
        productName: item.productName,
        quantity: item.quantity,
        deployedAt: new Date(),
      })
    }

    // Create temp sellers
    const sellerIds = []
    const credentials = []

    // Get count of existing temp sellers for username generation
    const existingTempCount = await Staff.countDocuments({
      userId: new mongoose.Types.ObjectId(session.userId),
      isTemporary: true,
    })

    for (let i = 0; i < (tempSellers?.length || 0); i++) {
      const seller = tempSellers[i]
      const count = existingTempCount + i + 1
      const username = generateTempUsername(seller.name.split(' ')[0], count)
      const pin = generateTempPIN()

      const newStaff = await Staff.create({
        userId: new mongoose.Types.ObjectId(ownerId),
        branchId: new mongoose.Types.ObjectId(sourceBranchId),
        name: seller.name,
        email: seller.email || `${username}@temp.local`,
        phone: seller.phone || '',
        password: pin, // Will be hashed by schema pre-save hook
        role: 'cashier',
        isTemporary: true,
        deploymentCount: 1,
        lastDeployedDate: new Date(),
        active: true,
        permissions: {
          'pos.sales': true,
          'pos.orders': true,
          'pos.inventory': false,
        },
      })

      sellerIds.push(newStaff._id)
      credentials.push({
        name: seller.name,
        username,
        pin,
        sellerId: newStaff._id.toString(),
      })
    }

    // Create mobile shop
    const shop = await MobileShop.create({
      userId: new mongoose.Types.ObjectId(session.userId),
      name,
      sourceBranchId: new mongoose.Types.ObjectId(sourceBranchId),
      status: 'active',
      stockOut: stockOutData,
      stockReturned: [],
      sellers: sellerIds,
      salesMade: {
        totalRevenue: 0,
        salesCount: 0,
        itemsSold: 0,
      },
      variance: [],
      deployedAt: new Date(),
      notes: notes || '',
    })

    // Update sellers with mobileShopId
    await Staff.updateMany(
      { _id: { $in: sellerIds } },
      { $set: { mobileShopId: shop._id } }
    )

    // Populate for response
    const populated = await MobileShop.findById(shop._id)
      .populate('sourceBranchId', 'name code')
      .populate('sellers', 'name email isTemporary')
      .lean()

    return NextResponse.json({
      message: 'Mobile shop deployed successfully',
      shop: populated,
      credentials, // Return credentials for printing
    })
  } catch (error: any) {
    console.error('[mobile-shops] POST error:', error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
