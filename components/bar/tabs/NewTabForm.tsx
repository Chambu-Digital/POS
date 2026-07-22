import { useState } from 'react'
import { useBarStore } from '@/store/bar-store'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function NewTabForm({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const { openTab } = useBarStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ customerName: '', tableNumber: '', notes: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const tabId = await openTab(formData)
      onOpenChange(false)
      router.push(`/dashboard/bar/tabs/${tabId}`)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open New Tab</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Customer Name (Optional)</Label>
            <Input 
              value={formData.customerName} 
              onChange={e => setFormData({ ...formData, customerName: e.target.value })} 
              placeholder="e.g. Walk-in"
            />
          </div>
          <div className="space-y-2">
            <Label>Table Number (Optional)</Label>
            <Input 
              value={formData.tableNumber} 
              onChange={e => setFormData({ ...formData, tableNumber: e.target.value })} 
              placeholder="e.g. T4"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Input 
              value={formData.notes} 
              onChange={e => setFormData({ ...formData, notes: e.target.value })} 
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Opening...' : 'Open Tab'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
