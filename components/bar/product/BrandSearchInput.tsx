import { useEffect, useState } from 'react'
import { useBarStore } from '@/store/bar-store'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

export function BrandSearchInput() {
  const { searchQuery, setSearchQuery, executeSearch } = useBarStore()
  const [localValue, setLocalValue] = useState(searchQuery)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localValue)
      executeSearch()
    }, 200)
    return () => clearTimeout(timer)
  }, [localValue, setSearchQuery, executeSearch])

  return (
    <div className="relative w-full">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search brands..."
        className="pl-9 w-full bg-background"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
      />
    </div>
  )
}
