import { useState } from 'react'
import { useBarStore } from '@/store/bar-store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function BottleOpenPrompt() {
  const { pendingBottleOpen, cancelBottleOpen, setBottleOpenConfirmed } = useBarStore()
  const [loading, setLoading] = useState(false)

  if (!pendingBottleOpen) return null

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await setBottleOpenConfirmed(pendingBottleOpen.inventoryItemId)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!pendingBottleOpen} onOpenChange={(open) => { if (!open) cancelBottleOpen() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open New Bottle</DialogTitle>
          <DialogDescription>
            You are about to serve {pendingBottleOpen.servingName || pendingBottleOpen.itemName}.
            There is no open bottle for this item. Do you want to open a new one?
            This will deduct 1 from the sealed stock.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={cancelBottleOpen} disabled={loading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Opening...' : 'Open Bottle & Serve'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
