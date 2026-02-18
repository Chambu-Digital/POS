/**
 * JSON Backup System using File System Access API
 * 
 * This module handles:
 * - Requesting folder permission from user
 * - Creating/updating backup JSON file
 * - Restoring from backup JSON file
 * - Snapshot mirroring from IndexedDB
 * 
 * Updated: 2026-02-14
 */

import { getCachedProducts, getCachedSales } from './indexeddb'

interface BackupData {
  lastUpdated: string
  shopId: string
  shopName: string
  sales: any[]
  products: any[]
  staff: Array<{ id: string; name: string; role: string }>
}

let directoryHandle: FileSystemDirectoryHandle | null = null
let backupEnabled = false

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'showDirectoryPicker' in window
}

/**
 * Check if backup is enabled
 */
export function isBackupEnabled(): boolean {
  return backupEnabled && directoryHandle !== null
}

/**
 * Request permission to access a directory for backups
 */
export async function requestBackupPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !isFileSystemAccessSupported()) {
    console.warn('[Backup] File System Access API not supported')
    return false
  }

  try {
    // Request directory access
    directoryHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    })

    // Verify we have write permission
    const permission = await directoryHandle.queryPermission({ mode: 'readwrite' })
    
    if (permission === 'granted') {
      backupEnabled = true
      localStorage.setItem('backup-enabled', 'true')
      console.log('[Backup] Permission granted')
      return true
    } else if (permission === 'prompt') {
      const newPermission = await directoryHandle.requestPermission({ mode: 'readwrite' })
      if (newPermission === 'granted') {
        backupEnabled = true
        localStorage.setItem('backup-enabled', 'true')
        console.log('[Backup] Permission granted after prompt')
        return true
      }
    }

    return false
  } catch (error) {
    console.error('[Backup] Permission request failed:', error)
    return false
  }
}

/**
 * Get backup file name based on shop name
 */
function getBackupFileName(shopName: string): string {
  const sanitized = shopName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  return `chambu-pos-backup-${sanitized}.json`
}

/**
 * Create or update backup JSON file
 */
export async function createBackupSnapshot(
  shopId: string,
  shopName: string,
  staffData?: Array<{ id: string; name: string; role: string }>
): Promise<boolean> {
  if (!isBackupEnabled() || !directoryHandle) {
    console.warn('[Backup] Backup not enabled or no directory handle')
    return false
  }

  try {
    // Get data from IndexedDB
    const sales = await getCachedSales()
    const products = await getCachedProducts()

    // Prepare backup data
    const backupData: BackupData = {
      lastUpdated: new Date().toISOString(),
      shopId,
      shopName,
      sales: sales || [],
      products: products || [],
      staff: staffData || [],
    }

    // Get or create file
    const fileName = getBackupFileName(shopName)
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true })

    // Write data
    const writable = await fileHandle.createWritable()
    await writable.write(JSON.stringify(backupData, null, 2))
    await writable.close()

    console.log('[Backup] Snapshot created:', fileName)
    localStorage.setItem('last-backup', new Date().toISOString())
    
    return true
  } catch (error) {
    console.error('[Backup] Failed to create snapshot:', error)
    return false
  }
}

/**
 * Restore from backup JSON file
 */
export async function restoreFromBackup(shopName: string): Promise<BackupData | null> {
  if (!isBackupEnabled() || !directoryHandle) {
    console.warn('[Backup] Backup not enabled or no directory handle')
    return null
  }

  try {
    const fileName = getBackupFileName(shopName)
    const fileHandle = await directoryHandle.getFileHandle(fileName)
    const file = await fileHandle.getFile()
    const text = await file.text()
    const backupData: BackupData = JSON.parse(text)

    console.log('[Backup] Restored from:', fileName, 'Date:', backupData.lastUpdated)
    return backupData
  } catch (error) {
    console.error('[Backup] Failed to restore from backup:', error)
    return null
  }
}

/**
 * Check if backup file exists
 */
export async function checkBackupExists(shopName: string): Promise<boolean> {
  if (!isBackupEnabled() || !directoryHandle) {
    return false
  }

  try {
    const fileName = getBackupFileName(shopName)
    await directoryHandle.getFileHandle(fileName)
    return true
  } catch {
    return false
  }
}

/**
 * Get last backup timestamp
 */
export function getLastBackupTime(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('last-backup')
}

/**
 * Initialize backup system on app start
 */
export function initBackupSystem(): void {
  if (typeof window === 'undefined') return
  const enabled = localStorage.getItem('backup-enabled') === 'true'
  if (enabled) {
    backupEnabled = true
    console.log('[Backup] System initialized (permission previously granted)')
  }
}

/**
 * Disable backup system
 */
export function disableBackup(): void {
  if (typeof window === 'undefined') return
  backupEnabled = false
  directoryHandle = null
  localStorage.removeItem('backup-enabled')
  localStorage.removeItem('last-backup')
  console.log('[Backup] System disabled')
}
