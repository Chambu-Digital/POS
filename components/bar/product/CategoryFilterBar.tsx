import { useBarStore } from '@/store/bar-store'
import { Button } from '@/components/ui/button'

export function CategoryFilterBar() {
  const { categories, categoryFilter, setCategoryFilter, executeSearch } = useBarStore()

  if (categories.length === 0) return null

  const handleSelect = (cat: string) => {
    const newCat = categoryFilter === cat ? '' : cat
    setCategoryFilter(newCat)
    executeSearch()
  }

  return (
    <div className="flex flex-wrap gap-2 py-1">
      <Button
        variant={categoryFilter === '' ? 'default' : 'outline'}
        size="sm"
        className="rounded-full"
        onClick={() => handleSelect('')}
      >
        All
      </Button>
      {categories.map(cat => (
        <Button
          key={cat}
          variant={categoryFilter === cat ? 'default' : 'outline'}
          size="sm"
          className="rounded-full"
          onClick={() => handleSelect(cat)}
        >
          {cat}
        </Button>
      ))}
    </div>
  )
}
