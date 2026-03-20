import { useState, useEffect, useCallback, useRef } from 'react'
import type { KDSOrder, OrderStatus, KDSFilter, KDSStats } from '@/types/kds'
import { computeStats } from '@/lib/kds-utils'

const POLL_INTERVAL = 8000

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:      'acknowledged',
  acknowledged: 'preparing',
  preparing:    'ready',
  ready:        'collected',
}

export function useKDS() {
  const [orders, setOrders] = useState<KDSOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<KDSFilter>('ALL')
  const [stats, setStats] = useState<KDSStats>({
    pending: 0, acknowledged: 0, preparing: 0, ready: 0, collected: 0, avgPrepTime: 0,
  })
  const prevOrderIds = useRef<Set<string>>(new Set())

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/kds')
      if (!res.ok) throw new Error('Failed to fetch orders')
      const data: { orders: KDSOrder[] } = await res.json()

      // Notify on new pending orders
      const newPending = data.orders.filter(
        o => o.status === 'pending' && !prevOrderIds.current.has(o.id)
      )
      if (newPending.length > 0 && prevOrderIds.current.size > 0) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`${newPending.length} new order(s) received!`)
        }
      }
      prevOrderIds.current = new Set(data.orders.map(o => o.id))

      setOrders(data.orders)
      setStats(computeStats(data.orders))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchOrders])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const advanceStatus = useCallback(async (orderId: string) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) return
    const next = NEXT_STATUS[order.status]
    if (!next) return

    // Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: next } : o))

    try {
      const res = await fetch('/api/kds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: next }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const data: { order: KDSOrder } = await res.json()
      setOrders(prev => prev.map(o => o.id === orderId ? data.order : o))
    } catch {
      // Revert on failure
      setOrders(prev => prev.map(o => o.id === orderId ? order : o))
    }
  }, [orders])

  const filteredOrders = filter === 'ALL'
    ? orders.filter(o => o.status !== 'collected')
    : orders.filter(o => o.status === filter)

  return {
    orders: filteredOrders,
    allOrders: orders,
    loading,
    error,
    filter,
    setFilter,
    stats,
    advanceStatus,
    refresh: fetchOrders,
  }
}
