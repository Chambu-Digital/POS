'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Branch {
  _id: string
  name: string
  code: string
  status: string
  isDefault: boolean
}

interface BranchSelectorProps {
  branches?: Branch[]
  selectedBranch?: Branch | null
  onBranchChange?: (branchId: string) => void
}

export function BranchSelector({ branches = [], selectedBranch, onBranchChange }: BranchSelectorProps) {
  const [isChanging, setIsChanging] = useState(false)

  async function handleBranchChange(branchId: string) {
    setIsChanging(true)
    try {
      const response = await fetch('/api/auth/select-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId }),
      })
      if (response.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to switch branch:', error)
    } finally {
      setIsChanging(false)
    }
  }

  if (!branches || branches.length === 0) {
    return null
  }

  if (branches.length === 1) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-[hsl(var(--sidebar-foreground))]/70">
        <Building2 size={16} />
        <span>{branches[0].name}</span>
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      <Select
        value={selectedBranch?._id || ''}
        onValueChange={handleBranchChange}
        disabled={isChanging}
      >
        <SelectTrigger className="w-full h-8 text-sm bg-[hsl(var(--sidebar-accent))]/20 border-0">
          <div className="flex items-center gap-2">
            <Building2 size={14} />
            <SelectValue placeholder="Select branch" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch._id} value={branch._id}>
              <div className="flex items-center gap-2">
                <span>{branch.name}</span>
                {branch.isDefault && <span className="text-xs text-muted-foreground">(Default)</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
