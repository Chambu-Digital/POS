'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2 } from 'lucide-react'
import { toast } from 'sonner'

interface QuickAddSupplierDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (supplier: { _id: string; name: string; phone?: string }) => void
}

export function QuickAddSupplierDialog({ open, onOpenChange, onSuccess }: QuickAddSupplierDialogProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleReset() {
    setName('')
    setPhone('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Supplier name is required')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          isActive: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create supplier')
      }

      const data = await response.json()
      toast.success(`Supplier "${data.supplier.name}" added`)
      handleReset()
      onOpenChange(false)
      onSuccess(data.supplier)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error creating supplier')
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (!isOpen) handleReset()
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 size={20} />
            Quick Add Supplier
          </DialogTitle>
          <DialogDescription>
            Add basic supplier info now. More details can be added later in the Suppliers page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supplier-name">
              Business Name *
            </Label>
            <Input
              id="supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., ABC Distributors"
              disabled={submitting}
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier-phone">
              Contact Phone <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="supplier-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 0722 123 456"
              disabled={submitting}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleReset()
                onOpenChange(false)
              }}
              disabled={submitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1"
            >
              {submitting ? 'Adding...' : 'Add Supplier'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
