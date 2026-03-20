'use client'

import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, checked, defaultChecked, onCheckedChange, ...props }, ref) => {
  // Track live checked state so inline styles update on toggle
  const [isChecked, setIsChecked] = React.useState(
    checked !== undefined ? checked : (defaultChecked ?? false)
  )

  // Sync when controlled `checked` prop changes externally
  React.useEffect(() => {
    if (checked !== undefined) setIsChecked(checked)
  }, [checked])

  function handleChange(val: boolean) {
    if (checked === undefined) setIsChecked(val) // uncontrolled
    onCheckedChange?.(val)
  }

  return (
    <SwitchPrimitives.Root
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={handleChange}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      style={{
        backgroundColor: isChecked ? '#2563eb' : '#d1d5db',
        borderColor:     isChecked ? '#2563eb' : '#9ca3af',
      }}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className="pointer-events-none block h-4 w-4 rounded-full shadow-md ring-0 transition-transform duration-200 data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0.5"
        style={{ backgroundColor: isChecked ? '#ffffff' : '#6b7280' }}
      />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
