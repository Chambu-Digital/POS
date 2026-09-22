import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

// ── GET: List notifications for current user ────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(request.url)
    
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    const query: any = {
      userId: ownerId,
      recipientId: payload.userId,
      recipientType: payload.type,
    }

    if (unreadOnly) {
      query.isRead = false
    }

    const notifications = await models.Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    const unreadCount = unreadOnly 
      ? notifications.length 
      : await models.Notification.countDocuments({
          ...query,
          isRead: false,
        })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('[notifications] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

// ── PUT: Mark notification as read ──────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { notificationId, markAllRead } = await request.json()

    if (markAllRead) {
      // Mark all as read
      await models.Notification.updateMany(
        {
          recipientId: payload.userId,
          recipientType: payload.type,
          isRead: false,
        },
        {
          $set: { isRead: true, readAt: new Date() }
        }
      )
      return NextResponse.json({ message: 'All notifications marked as read' })
    }

    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId is required' }, { status: 400 })
    }

    // Mark single notification as read
    const notification = await models.Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipientId: payload.userId,
        recipientType: payload.type,
      },
      {
        $set: { isRead: true, readAt: new Date() }
      },
      { new: true }
    )

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    return NextResponse.json({ notification })
  } catch (error) {
    console.error('[notifications] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}
