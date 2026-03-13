'use client'

import { ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface FloatingCartButtonProps {
  itemCount: number
  onClick: () => void
}

export function FloatingCartButton({ itemCount, onClick }: FloatingCartButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 md:hidden"
      aria-label={`Shopping cart with ${itemCount} items`}
    >
      {/* Red Cart SVG */}
      <div className="relative flex flex-col items-center">
        {/* Badge with item count - Above the cart */}
        {itemCount > 0 && (
          <Badge
            className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white hover:bg-green-700 font-bold text-xs w-6 h-6 flex items-center justify-center p-0 rounded-full"
          >
            {itemCount > 99 ? '99+' : itemCount}
          </Badge>
        )}

        <svg
          width="56"
          height="56"
          viewBox="0 0 56 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-lg"
        >
          {/* Red background circle */}
          <circle cx="28" cy="28" r="28" fill="#ef4444" />
          
          {/* Cart icon */}
          <g transform="translate(28, 28)">
            {/* Cart body */}
            <path
              d="M-12 -4L-10 8C-10 9.1 -9.1 10 -8 10H10C11.1 10 12 9.1 12 8L14 -4M-12 -4H14M-4 10V14M4 10V14"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            
            {/* Wheels */}
            <circle cx="-4" cy="16" r="1.5" fill="white" />
            <circle cx="4" cy="16" r="1.5" fill="white" />
          </g>
        </svg>
      </div>
    </button>
  )
}
