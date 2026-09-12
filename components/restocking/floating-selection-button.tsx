'use client'

interface FloatingSelectionButtonProps {
  selectedCount: number
  onClick: () => void
}

export function FloatingSelectionButton({ selectedCount, onClick }: FloatingSelectionButtonProps) {
  if (selectedCount === 0) return null

  return (
    <button
      onClick={onClick}
      aria-label={`Add ${selectedCount} selected item${selectedCount !== 1 ? 's' : ''} to basket`}
      className="fixed bottom-20 right-5 z-40 focus:outline-none"
    >
      <div className="relative">
        {/* Glow ring */}
        <span className="absolute inset-0 rounded-2xl bg-blue-400 opacity-20 animate-ping" />

        {/* Main pill button */}
        <div
          className="relative flex items-center gap-2.5 px-4 py-3 rounded-2xl text-white"
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 60%, #60a5fa 100%)',
            boxShadow: '0 8px 24px rgba(37,99,235,0.45), 0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {/* Shopping cart icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M9 2L7.17 4H3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1l1.8 9a3 3 0 0 0 2.95 2.5h6.5A3 3 0 0 0 18.2 16L20 7h1a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-4.17L15 2H9z"
              fill="rgba(255,255,255,0.2)"
              stroke="white"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="20" r="1" fill="white" />
            <circle cx="16" cy="20" r="1" fill="white" />
          </svg>

          {/* Count */}
          <span className="text-sm font-bold leading-none tabular-nums">
            {selectedCount > 99 ? '99+' : selectedCount}
          </span>
        </div>
      </div>
    </button>
  )
}
