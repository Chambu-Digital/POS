'use client'

interface FloatingCartButtonProps {
  itemCount: number
  onClick: () => void
}

export function FloatingCartButton({ itemCount, onClick }: FloatingCartButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={`Cart — ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
      className="fixed bottom-20 right-5 z-40 md:hidden focus:outline-none"
    >
      <div className="relative">
        {/* Glow ring when cart has items */}
        {itemCount > 0 && (
          <span className="absolute inset-0 rounded-2xl bg-emerald-400 opacity-20 animate-ping" />
        )}

        {/* Main pill button */}
        <div
          className="relative flex items-center gap-2.5 px-4 py-3 rounded-2xl text-white"
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #10b981 60%, #34d399 100%)',
            boxShadow: '0 8px 24px rgba(16,185,129,0.45), 0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {/* Shopping bag SVG */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Bag handle */}
            <path
              d="M8 10V7a4 4 0 0 1 8 0v3"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Bag body */}
            <path
              d="M5 10h14l-1.5 9.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 10z"
              fill="rgba(255,255,255,0.2)"
              stroke="white"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            {/* Subtle shine line on bag */}
            <path
              d="M9 14h6"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>

          {/* Count */}
          {itemCount > 0 && (
            <span className="text-sm font-bold leading-none tabular-nums">
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          )}
        </div>

        {/* Dot indicator when empty */}
        {itemCount === 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white" />
        )}
      </div>
    </button>
  )
}
