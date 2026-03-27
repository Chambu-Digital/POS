'use client'

import { resolveMediaUrl } from '@/lib/media-url'
import { cn } from '@/lib/utils'

interface ProductImageProps {
  src?: string | null
  alt: string
  className?: string
  /** Size preset — overridden by className if provided */
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const sizeMap = {
  xs: 'w-8 h-8 text-[7px]',
  sm: 'w-10 h-10 text-[7px]',
  md: 'w-12 h-12 text-[8px]',
  lg: 'w-full h-full text-[9px]',
}

export function ProductImage({ src, alt, className, size = 'md' }: ProductImageProps) {
  const resolved = resolveMediaUrl(src ?? '')

  return (
    <div
      className={cn(
        'rounded-md overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center',
        sizeMap[size],
        className
      )}
    >
      {resolved ? (
        <img
          src={resolved}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="text-center text-muted-foreground leading-tight px-1 text-[inherit]">
          No Image
        </span>
      )}
    </div>
  )
}
