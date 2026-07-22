import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { useBarStore } from '@/store/bar-store'

export function TabLineItem({ line, tabId }: { line: any, tabId: string }) {
  const { deleteLastLine } = useBarStore()

  return (
    <div className={`flex justify-between items-center py-2 border-b ${line.voided ? 'opacity-50 line-through' : ''}`}>
      <div>
        <p className="font-medium">{line.itemName} {line.servingName ? `(${line.servingName})` : ''}</p>
        <p className="text-sm text-muted-foreground">{line.quantity} x {line.unitPrice.toLocaleString()}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-semibold">{line.lineTotal.toLocaleString()}</span>
        {!line.voided && (
          <Button variant="ghost" size="icon" onClick={() => deleteLastLine(tabId, line._id)}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        )}
      </div>
    </div>
  )
}
