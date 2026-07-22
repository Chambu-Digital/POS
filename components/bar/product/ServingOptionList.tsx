import { Button } from '@/components/ui/button'

export function ServingOptionList({ servings, onAdd }: { servings: any[], onAdd: (serving: any) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {servings.map(serving => (
        <Button
          key={serving._id}
          variant="outline"
          size="sm"
          className="w-full justify-between"
          onClick={() => onAdd(serving)}
        >
          <span>{serving.name}</span>
          <span>KES {serving.sellingPrice.toLocaleString()}</span>
        </Button>
      ))}
    </div>
  )
}
