'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Package, XCircle, Info, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Notification {
  _id: string
  type: string
  title: string
  message: string
  referenceId?: string
  referenceType?: string
  isRead: boolean
  createdAt: string
}

interface NotificationListProps {
  onUpdate?: () => void
  onClose?: () => void
}

export function NotificationList({ onUpdate, onClose }: NotificationListProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    fetchNotifications()
  }, [filter])

  async function fetchNotifications() {
    try {
      const url = filter === 'unread' 
        ? '/api/notifications?unreadOnly=true&limit=50'
        : '/api/notifications?limit=50'
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      })

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
        )
        onUpdate?.()
      }
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  async function markAllAsRead() {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        onUpdate?.()
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      markAsRead(notification._id)
    }

    // Navigate to reference if available
    if (notification.referenceType === 'stock_transfer') {
      onClose?.()
      router.push('/dashboard/stock-transfers')
    }
  }

  function getIcon(type: string) {
    switch (type) {
      case 'transfer_received':
        return <Package size={18} className="text-blue-500" />
      case 'transfer_rejected':
        return <XCircle size={18} className="text-red-500" />
      default:
        return <Info size={18} className="text-gray-500" />
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs h-7"
            >
              <CheckCheck size={14} className="mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        {/* Filter tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-3 py-1 text-sm rounded-md transition-colors',
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={cn(
              'px-3 py-1 text-sm rounded-md transition-colors',
              filter === 'unread'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Bell size={48} className="text-muted-foreground mb-3 opacity-20" />
            <p className="text-sm text-muted-foreground">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map(notification => (
              <button
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  'w-full p-4 text-left hover:bg-muted/50 transition-colors',
                  !notification.isRead && 'bg-blue-50/50 dark:bg-blue-950/20'
                )}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={cn(
                        'text-sm font-medium',
                        !notification.isRead && 'font-semibold'
                      )}>
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
