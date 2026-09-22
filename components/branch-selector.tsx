'use client'

import { useState } from 'react'
import { Check, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Branch {
  _id: string
  name: string
  code: string
  status: string
}

interface BranchSelectorProps {
  branches: Branch[]
  selectedBranch: Branch | null
}

export function BranchSelector({ branches, selectedBranch }: BranchSelectorProps) {
  const [isChanging, setIsChanging] = useState(false)
  const [currentBranch, setCurrentBranch] = useState(selectedBranch)

  async function handleBranchSelect(branch: Branch) {
    if (currentBranch?._id === branch._id) return

    setIsChanging(true)
    try {
      const response = await fetch('/api/auth/select-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: branch._id }),
      })

      if (response.ok) {
        setCurrentBranch(branch)
        toast.success(`Switched to ${branch.name}`)
        
        // Reload to update data for new branch context
        setTimeout(() => {
          window.location.reload()
        }, 500)
      } else {
        toast.error('Failed to switch branch')
      }
    } catch (error) {
      console.error('Failed to select branch:', error)
      toast.error('Failed to switch branch')
    } finally {
      setIsChanging(false)
    }
  }

  if (branches.length === 0) return null

  const activeBranches = branches.filter(b => b.status === 'active')
  if (activeBranches.length === 0) return null

  return (
    <div className="mb-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] hover:bg-[hsl(var(--sidebar-accent))]/80 hover:text-[hsl(var(--sidebar-accent-foreground))]"
            disabled={isChanging}
          >
            <Building2 size={16} className="mr-2" />
            <span className="truncate flex-1 text-left">
              {currentBranch?.name || 'Select Branch'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          <DropdownMenuLabel>Switch Branch</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {activeBranches.map(branch => (
            <DropdownMenuItem
              key={branch._id}
              onClick={() => handleBranchSelect(branch)}
              className={cn(
                'flex items-center justify-between cursor-pointer',
                currentBranch?._id === branch._id && 'bg-accent'
              )}
            >
              <div className="flex flex-col">
                <span className="font-medium">{branch.name}</span>
                <span className="text-xs text-muted-foreground">{branch.code}</span>
              </div>
              {currentBranch?._id === branch._id && (
                <Check size={16} className="text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
