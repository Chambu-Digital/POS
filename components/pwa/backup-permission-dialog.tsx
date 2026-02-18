'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Shield, HardDrive, Wifi, RefreshCw } from 'lucide-react'
import { requestBackupPermission, isFileSystemAccessSupported } from '@/lib/backup'
import { toast } from 'sonner'

export function BackupPermissionDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return

    // Check if we should show the dialog
    const backupEnabled = localStorage.getItem('backup-enabled')
    const backupDismissed = localStorage.getItem('backup-dismissed')
    
    // Show on first launch if not enabled and not dismissed
    if (!backupEnabled && !backupDismissed && isFileSystemAccessSupported()) {
      // Delay to let the app load first
      setTimeout(() => {
        setOpen(true)
      }, 2000)
    }
  }, [])

  async function handleEnable() {
    setLoading(true)
    try {
      const granted = await requestBackupPermission()
      if (granted) {
        toast.success('Automatic backup enabled')
        setOpen(false)
      } else {
        toast.error('Permission denied. You can enable backup later in settings.')
      }
    } catch (error) {
      toast.error('Failed to enable backup')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function handleSkip() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('backup-dismissed', 'true')
    }
    setOpen(false)
    toast.info('You can enable backup anytime in settings')
  }

  if (!isFileSystemAccessSupported()) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="text-primary" size={24} />
            Enable Automatic Local Backup?
          </DialogTitle>
          <DialogDescription className="text-base">
            Protect your business data with automatic local backups
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <Wifi className="text-green-600" size={20} />
              </div>
              <div>
                <p className="font-medium">Works Offline</p>
                <p className="text-sm text-muted-foreground">
                  Continue making sales even without internet connection
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1">
                <HardDrive className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="font-medium">Survives Browser Issues</p>
                <p className="text-sm text-muted-foreground">
                  Data safe even if browser cache is cleared or computer restarts
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1">
                <RefreshCw className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="font-medium">Automatic Sync</p>
                <p className="text-sm text-muted-foreground">
                  Syncs with cloud when internet is available
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="font-medium mb-1">How it works:</p>
            <p className="text-muted-foreground">
              You'll choose a folder on your computer where backup files will be saved. 
              The app will automatically update the backup after each sale.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSkip}
            variant="outline"
            className="flex-1"
            disabled={loading}
          >
            Skip for now
          </Button>
          <Button
            onClick={handleEnable}
            className="flex-1"
            disabled={loading}
          >
            {loading ? 'Setting up...' : 'Enable Backup'}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          You can change this setting anytime in Settings
        </p>
      </DialogContent>
    </Dialog>
  )
}
