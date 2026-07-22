import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Serving {
  _id: string
  name: string
  unitsProduced: number
  sellingPrice: number
}

interface Product {
  _id: string
  size: string
  brandName: string
  brandCategory: string
  bottleSellingPrice: number
  stock: number
  lowStockThreshold: number
  hasOpenBottle: boolean
  servings: Serving[]
}

interface Props {
  item: Product
  onAdd: (inventoryItemId: string, servingId: string | null, price: number, name: string, servingName?: string) => void
}

export function InventoryItemCard({ item, onAdd }: Props) {
  const outOfStock = item.stock <= 0
  const lowStock   = !outOfStock && item.stock <= item.lowStockThreshold
  const label      = `${item.brandName} ${item.size}`

  return (
    <Card className={cn('flex flex-col', outOfStock && 'opacity-60')}>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm leading-tight truncate">{item.brandName}</CardTitle>
            <p className="text-xs text-muted-foreground">{item.size}</p>
          </div>
          <Badge
            variant={outOfStock ? 'destructive' : lowStock ? 'outline' : 'secondary'}
            className="text-[10px] shrink-0"
          >
            {outOfStock ? 'Out of stock' : `${item.stock} left`}
          </Badge>
        </div>
        {item.hasOpenBottle && (
          <p className="text-[10px] text-orange-500 font-medium mt-1">● Bottle open</p>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-0 flex flex-col gap-1.5 flex-grow">
        {/* Whole-bottle button */}
        {item.bottleSellingPrice > 0 && (
          <button
            disabled={outOfStock}
            onClick={() => onAdd(item._id, null, item.bottleSellingPrice, label, 'Full Bottle')}
            className={cn(
              'w-full flex justify-between items-center px-3 py-2 rounded-md text-sm',
              'bg-muted hover:bg-primary/10 hover:ring-1 hover:ring-primary transition-colors',
              outOfStock && 'pointer-events-none'
            )}
          >
            <span className="font-medium">Full Bottle</span>
            <span className="text-primary font-semibold">KES {item.bottleSellingPrice.toLocaleString()}</span>
          </button>
        )}

        {/* Serving buttons */}
        {item.servings.length > 0 && (
          <div className="space-y-1">
            {item.bottleSellingPrice > 0 && (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                Servings
              </p>
            )}
            {item.servings.map(s => (
              <button
                key={s._id}
                onClick={() => onAdd(item._id, s._id, s.sellingPrice, label, s.name)}
                className="w-full flex justify-between items-center px-3 py-2 rounded-md text-sm
                           bg-muted hover:bg-primary/10 hover:ring-1 hover:ring-primary transition-colors"
              >
                <span className="font-medium">
                  {s.name}
                  <span className="text-muted-foreground font-normal ml-1 text-xs">
                    ×{s.unitsProduced}/btl
                  </span>
                </span>
                <span className="text-primary font-semibold">KES {s.sellingPrice.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}

        {item.bottleSellingPrice === 0 && item.servings.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-2">No prices configured</p>
        )}
      </CardContent>
    </Card>
  )
}
