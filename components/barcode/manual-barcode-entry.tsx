'use client'

import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScanLine } from 'lucide-react'
import { CameraScanner } from './camera-scanner'

interface Props {
  onSubmit: (code: string) => void
  onFocus?: () => void
  onBlur?: () => void
  disabled?: boolean
}

export function ManualBarcodeEntry({ onSubmit, onFocus, onBlur, disabled }: Props) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
    inputRef.current?.focus()
  }

  function handleCameraScan(code: string) {
    onSubmit(code)
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <div className="relative flex-1">
        <ScanLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Enter barcode manually..."
          className="pl-8"
          disabled={disabled}
          autoComplete="off"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={!value.trim() || disabled}>
        Add
      </Button>
      <CameraScanner onScan={handleCameraScan} disabled={disabled} />
    </form>
  )
}
