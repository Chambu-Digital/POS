// ─── KDS Order Card ───────────────────────────────────────────────────────────
// Place this file at: components/kds/OrderCard.tsx

'use client'

import { useState, useEffect } from 'react'
import { ChefHat, Bell, CheckCheck, Clock, Flame, Crown, Users, AlarmClock } from 'lucide-react'
import type { KDSOrder, OrderStatus, ViewMode } from '@/types/kds'
import { CATEGORY_CONFIG, formatElapsed, formatTime, getUrgencyLevel } from '@/lib/kds-utils'

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


  const urgencyStyles = {
    normal:   { border: 'var(--kds-border)',     glow: 'none',                             headerBg: 'var(--kds-card-header)' },
    warning:  { border: '#d97706',               glow: '0 0 18px rgba(217,119,6,0.2)',     headerBg: 'rgba(217,119,6,0.1)'    },
    critical: { border: '#dc2626',               glow: '0 0 24px rgba(220,38,38,0.25)',    headerBg: 'rgba(220,38,38,0.1)'    },
  }
  const us = urgencyStyles[urgency]

  const priorityIcon = order.priority === 'vip'
    ? <Crown size={12} className="inline" style={{ color: '#fbbf24' }} />
    : order.priority === 'rush'
    ? <Flame  size={12} className="inline" style={{ color: '#ef4444' }} />
    : null

  const statusTimeline: { label: string; time?: string; done: boolean }[] = [
    { label: 'Ordered',      time: order.createdAt,      done: true },
    { label: 'Acknowledged', time: order.acknowledgedAt, done: !!order.acknowledgedAt },
    { label: 'Preparing',    time: order.preparingAt,    done: !!order.preparingAt },
    { label: 'Ready',        time: order.readyAt,        done: !!order.readyAt },
    { label: 'Collected',    time: order.collectedAt,    done: !!order.collectedAt },
  ]

  return (
    <div
      className="kds-order-card"
      style={{
        border: `1.5px solid ${us.border}`,
        boxShadow: us.glow,
        borderRadius: '14px',
        overflow: 'hidden',
        background: 'var(--kds-card-bg)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        ...style,
      }}
    >
      {/* ── Card Header ─────────────────────────────────────────────────────── */}
      <div style={{ background: us.headerBg, padding: '12px 14px', borderBottom: `1px solid ${us.border}44` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>

          {/* Left: Order number + priority */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                fontSize: 20,
                color: 'var(--kds-text-primary)',
                letterSpacing: '-0.02em',
              }}>
                {order.orderNumber}
              </span>
              {order.priority !== 'normal' && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '2px 7px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  background: order.priority === 'vip' ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
                  color: order.priority === 'vip' ? '#fbbf24' : '#ef4444',
                  border: `1px solid ${order.priority === 'vip' ? '#fbbf2444' : '#ef444444'}`,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {priorityIcon} {order.priority.toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--kds-text-secondary)', fontWeight: 600 }}>
                Table {order.tableNumber}
              </span>
              {order.tableSection && (
                <span style={{ fontSize: 11, color: 'var(--kds-text-muted)' }}>
                  {order.tableSection}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--kds-text-muted)' }}>
                <Users size={11} /> {order.coverCount}
              </span>
            </div>
          </div>

          {/* Right: Timer + status */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              color: urgency === 'critical' ? '#ef4444' : urgency === 'warning' ? '#d97706' : 'var(--kds-text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700,
            }}>
              {urgency !== 'normal' && <AlarmClock size={13} />}
              <LiveTimer date={order.createdAt} />
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.07em',
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: 4,
              ...(order.status === 'pending'      ? { background: 'rgba(59,130,246,0.15)',  color: '#60a5fa',  border: '1px solid #3b82f644' } :
                  order.status === 'acknowledged' ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa',  border: '1px solid #8b5cf644' } :
                  order.status === 'preparing'    ? { background: 'rgba(249,115,22,0.15)', color: '#fb923c',  border: '1px solid #f9731644' } :
                  order.status === 'ready'        ? { background: 'rgba(34,197,94,0.15)',  color: '#4ade80',  border: '1px solid #22c55e44' } :
                                                    { background: 'rgba(100,116,139,0.15)',color: '#94a3b8',  border: '1px solid #64748b44' }),
            }}>
              {order.status === 'pending'      ? 'NEW ORDER'    :
               order.status === 'acknowledged' ? 'SEEN'         :
               order.status === 'preparing'    ? 'COOKING'      :
               order.status === 'ready'        ? '✓ READY'      : 'COLLECTED'}
            </span>
          </div>
        </div>

        {/* Waiter + Chef info */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--kds-text-muted)' }}>
          <span>🧑‍💼 {order.waiterName}</span>
          {order.assignedChefName && <span>👨‍🍳 {order.assignedChefName}</span>}
        </div>
      </div>

      {/* ── Items List ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {order.items.map(item => {
          const cat = CATEGORY_CONFIG[item.category]
          return (
            <div key={item.id} style={{
              display: 'flex',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 8,
              background: 'var(--kds-item-bg)',
              border: '1px solid var(--kds-item-border)',
              alignItems: 'flex-start',
            }}>
              <span style={{
                background: cat.bg,
                color: cat.color,
                border: `1px solid ${cat.color}44`,
                borderRadius: 3,
                padding: '1px 6px',
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.04em',
                fontFamily: 'var(--font-mono)',
                marginTop: 1,
                whiteSpace: 'nowrap',
              }}>
                {cat.label.toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'block',
                  color: 'var(--kds-text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: cat.color, marginRight: 4 }}>
                    ×{item.quantity}
                  </span>
                  {item.name}
                  {item.prepTime && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--kds-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      ~{item.prepTime}m
                    </span>
                  )}
                </span>
                {item.notes && (
                  <span style={{
                    display: 'block',
                    fontSize: 11,
                    color: '#fbbf24',
                    fontStyle: 'italic',
                    marginTop: 2,
                  }}>
                    ✏ {item.notes}
                  </span>
                )}
                {item.modifications?.map((mod: string, i: number) => (
                  <span key={i} style={{ display: 'block', fontSize: 11, color: '#a78bfa', marginTop: 1 }}>
                    + {mod}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Timeline ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--kds-item-border)',
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        overflowX: 'auto',
      }}>
        {statusTimeline.filter(s => s.done).map((s, i, arr) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <div style={{
              fontSize: 10,
              color: i === arr.length - 1 ? 'var(--kds-text-secondary)' : 'var(--kds-text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              {s.label}: {formatTime(s.time!)}
            </div>
            {i < arr.length - 1 && (
              <span style={{ color: 'var(--kds-text-muted)', fontSize: 10 }}>→</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Action Buttons ───────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--kds-item-border)', display: 'flex', gap: 8 }}>
        {/* Chef actions */}
        {viewMode === 'chef' && order.status === 'pending' && (
          <button
            onClick={() => onUpdateStatus(order.id, 'acknowledged')}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #3b82f6',
              background: 'rgba(59,130,246,0.12)', color: '#60a5fa', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Bell size={14} /> Acknowledge
          </button>
        )}
        {viewMode === 'chef' && order.status === 'acknowledged' && (
          <button
            onClick={() => onUpdateStatus(order.id, 'preparing')}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #ea580c, #c2410c)', color: '#fff', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <ChefHat size={14} /> Start Preparing
          </button>
        )}
        {viewMode === 'chef' && order.status === 'preparing' && (
          <button
            onClick={() => onUpdateStatus(order.id, 'ready')}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              animation: 'none',
            }}
          >
            <Bell size={14} /> Order Ready — Notify Waiter
          </button>
        )}
        {viewMode === 'chef' && (order.status === 'ready' || order.status === 'collected') && (
          <div style={{
            flex: 1, padding: '9px 12px', borderRadius: 8,
            background: 'var(--kds-item-bg)', color: 'var(--kds-text-muted)',
            fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            border: '1px solid var(--kds-item-border)',
          }}>
            {order.status === 'ready' ? '⏳ Awaiting waiter pickup' : '✓ Order delivered'}
          </div>
        )}

        {/* Waiter actions */}
        {viewMode === 'waiter' && order.status === 'ready' && (
          <button
            onClick={() => onUpdateStatus(order.id, 'collected')}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 0 16px rgba(14,165,233,0.4)',
              animation: 'collectPulse 2s ease-in-out infinite',
            }}
          >
            <CheckCheck size={16} /> Collect & Deliver
          </button>
        )}
        {viewMode === 'waiter' && order.status !== 'ready' && (
          <div style={{
            flex: 1, padding: '9px 12px', borderRadius: 8,
            background: 'var(--kds-item-bg)', color: 'var(--kds-text-muted)',
            fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            border: '1px solid var(--kds-item-border)',
          }}>
            <Clock size={13} />
            {order.status === 'preparing'    ? 'Chef is preparing...' :
             order.status === 'acknowledged' ? 'Chef acknowledged...' :
             order.status === 'collected'    ? '✓ Delivered to table' : 'Pending kitchen'}
          </div>
        )}
      </div>
    </div>
  )
}