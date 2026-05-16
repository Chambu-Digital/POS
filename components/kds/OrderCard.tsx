'use client'

import { useState, useEffect } from 'react'
import type { KDSOrder, OrderStatus, ViewMode } from '@/types/kds'
import { CATEGORY_CONFIG, formatElapsed, formatTime, getUrgencyLevel } from '@/lib/kds-utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface OrderCardProps {
  order: KDSOrder
  viewMode: ViewMode
  onUpdateStatus: (orderId: string, status: OrderStatus) => void
  style?: React.CSSProperties
}

function LiveTimer({ date, className }: { date: string; className?: string }) {
  const [display, setDisplay] = useState(formatElapsed(date))
  useEffect(() => {
    const t = setInterval(() => setDisplay(formatElapsed(date)), 1000)
    return () => clearInterval(t)
  }, [date])
  return <span className={className}>{display}</span>
}

export function OrderCard({ order, viewMode, onUpdateStatus, style }: OrderCardProps) {
  const urgency = getUrgencyLevel(order)

  const urgencyClasses = {
    normal: 'border-gray-200',
    warning: 'border-amber-400 shadow-amber-100',
    critical: 'border-red-500 shadow-red-100',
  }

  const statusConfig = {
    pending: { label: 'NEW ORDER', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    preparing: { label: 'COOKING', color: 'bg-orange-100 text-orange-700 border-orange-300' },
    ready: { label: ' READY', color: 'bg-green-100 text-green-700 border-green-300' },
    served: { label: 'SERVED', color: 'bg-gray-100 text-gray-700 border-gray-300' },
    cancelled: { label: 'CANCELLED', color: 'bg-red-100 text-red-700 border-red-300' },
  }

  const priorityBadge = {
    normal: null,
    rush: <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">🔥 RUSH</Badge>,
    vip: <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">👑 VIP</Badge>,
  }

  return (
    <Card 
      className={`${urgencyClasses[urgency]} border-2 transition-all hover:shadow-lg`}
      style={style}
    >
      <CardHeader className={`pb-3 ${order.status === 'ready' ? 'bg-green-50' : 'bg-gray-50'}`}>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-2xl font-black font-mono">{order.orderNumber}</span>
              {priorityBadge[order.priority]}
              <Badge className={`${statusConfig[order.status].color} text-xs font-bold`}>
                {statusConfig[order.status].label}
              </Badge>
            </div>
            <div className="text-sm text-gray-600 flex gap-2 flex-wrap">
              <span className="font-semibold">Table {order.tableNumber}</span>
              {order.tableSection && <span>• {order.tableSection}</span>}
              <span>• {order.coverCount} guests</span>
              <span>• {order.orderType}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              🧑‍💼 {order.waiterName}
              {order.assignedChefName && <span> • 👨‍🍳 {order.assignedChefName}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <LiveTimer 
              date={order.createdAt} 
              className={`font-mono font-bold text-sm ${
                urgency === 'critical' ? 'text-red-600' : 
                urgency === 'warning' ? 'text-amber-600' : 
                'text-gray-600'
              }`}
            />
            <div className="text-xs text-gray-500 mt-1">
              {formatTime(order.createdAt)}
            </div>
            {urgency === 'critical' && (
              <div className="text-xs text-red-600 font-bold mt-1">⚠ OVERDUE</div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Items */}
        <div className="space-y-2">
          {order.items.map(item => {
            const cat = CATEGORY_CONFIG[item.category]
            return (
              <div 
                key={item.id} 
                className="flex gap-2 p-2 bg-gray-50 border border-gray-200"
              >
                <Badge 
                  variant="outline" 
                  className="text-xs font-bold shrink-0"
                  style={{ 
                    backgroundColor: cat.bg, 
                    color: cat.color,
                    borderColor: cat.color + '44'
                  }}
                >
                  {cat.label.toUpperCase()}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">
                    <span className="text-green-600 font-mono mr-2">×{item.quantity}</span>
                    {item.name}
                    {item.prepTime && (
                      <span className="text-xs text-gray-500 ml-2">~{item.prepTime}m</span>
                    )}
                  </div>
                  {item.notes && (
                    <div className="text-sm text-amber-600 italic mt-1">
                      ✏ {item.notes}
                    </div>
                  )}
                  {item.station && (
                    <Badge variant="outline" className="text-xs mt-1">
                      {item.station}
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Special instructions */}
        {order.notes && (
          <div className="p-2 bg-amber-50 border border-amber-200 text-sm text-amber-800">
            📌 {order.notes}
          </div>
        )}

        {/* Timeline */}
        <div className="text-xs text-gray-500 flex gap-2 flex-wrap">
          <span>🕐 {formatTime(order.createdAt)}</span>
          {order.preparingAt && <span>→ 👨‍🍳 {formatTime(order.preparingAt)}</span>}
          {order.readyAt && <span>→ ✓ {formatTime(order.readyAt)}</span>}
          {order.servedAt && <span>→ �️ {formatTime(order.servedAt)}</span>}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {/* Chef actions */}
          {viewMode === 'chef' && order.status === 'pending' && (
            <Button 
              onClick={() => onUpdateStatus(order.id, 'preparing')}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
               Start Preparing
            </Button>
          )}
          
          {viewMode === 'chef' && order.status === 'preparing' && (
            <Button 
              onClick={() => onUpdateStatus(order.id, 'ready')}
              className="w-full bg-green-600 hover:bg-green-700"
            >
               Order Ready — Notify Waiter
            </Button>
          )}
          
          {viewMode === 'chef' && order.status === 'ready' && (
            <div className="p-3 bg-green-50 border border-green-200 text-center text-sm text-green-700 font-semibold">
               Awaiting waiter pickup
            </div>
          )}

          {viewMode === 'chef' && order.status === 'served' && (
            <div className="p-3 bg-gray-50 border border-gray-200 text-center text-sm text-gray-600">
              ✓ Order delivered to table
            </div>
          )}

          {/* Waiter actions */}
          {viewMode === 'waiter' && order.status === 'ready' && (
            <Button 
              onClick={() => onUpdateStatus(order.id, 'served')}
              className="w-full bg-blue-600 hover:bg-blue-700 animate-pulse"
            >
              Collect & Serve to Table
            </Button>
          )}
          
          {viewMode === 'waiter' && order.status !== 'ready' && (
            <div className="p-3 bg-gray-50 border border-gray-200 text-center text-sm text-gray-600">
              {order.status === 'preparing' ? '👨‍🍳 Chef is preparing...' :
               order.status === 'served' ? '✓ Delivered to table' :
               order.status === 'pending' ? '⏳ Pending kitchen' :
               'Order completed'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
