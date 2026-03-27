'use client'

// ─── CameraScanner ─────────────────────────────────────────────────────────────
// Mobile camera barcode scanning via @zxing/browser.
// Permission is requested once; the browser remembers it natively.
// Last-used device ID is persisted in localStorage so rear cam is reused.

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import { Button } from '@/components/ui/button'
import { Camera, CameraOff, SwitchCamera, X } from 'lucide-react'

const DEVICE_KEY = 'barcode_camera_deviceId'

interface Props {
  onScan: (code: string) => void
  disabled?: boolean
}

type ScannerStatus = 'idle' | 'requesting' | 'scanning' | 'denied' | 'error'

export function CameraScanner({ onScan, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<ScannerStatus>('idle')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>()
  const [errorMsg, setErrorMsg] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)

  // Load persisted device preference
  useEffect(() => {
    const saved = localStorage.getItem(DEVICE_KEY)
    if (saved) setActiveDeviceId(saved)
  }, [])

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
  }, [])

  const startScanner = useCallback(async (deviceId?: string) => {
    if (!videoRef.current) return
    setStatus('requesting')
    setErrorMsg('')

    try {
      // Enumerate devices — this also triggers the permission prompt if needed
      const allDevices = await BrowserMultiFormatReader.listVideoInputDevices()
      setDevices(allDevices)

      if (allDevices.length === 0) {
        setStatus('error')
        setErrorMsg('No camera found on this device.')
        return
      }

      // Pick device: explicit > saved > prefer back camera > first
      let chosenId = deviceId ?? activeDeviceId
      if (!chosenId) {
        const back = allDevices.find((d) =>
          /back|rear|environment/i.test(d.label)
        )
        chosenId = back?.deviceId ?? allDevices[0].deviceId
      }

      setActiveDeviceId(chosenId)
      localStorage.setItem(DEVICE_KEY, chosenId)

      stopScanner()

      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      const controls = await reader.decodeFromVideoDevice(
        chosenId,
        videoRef.current,
        (result, err) => {
          if (result) {
            onScan(result.getText())
            // Brief pause so the same code isn't fired twice in a row
            stopScanner()
            setTimeout(() => startScanner(chosenId), 1200)
          }
          // NotFoundException is normal (no barcode in frame) — ignore it
          if (err && !(err instanceof NotFoundException)) {
            console.warn('[CameraScanner]', err)
          }
        }
      )

      controlsRef.current = controls
      setStatus('scanning')
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setStatus('denied')
        setErrorMsg('Camera permission denied. Please allow camera access in your browser settings.')
      } else {
        setStatus('error')
        setErrorMsg(err?.message ?? 'Failed to start camera.')
      }
    }
  }, [activeDeviceId, onScan, stopScanner])

  // Start/stop when overlay opens/closes
  useEffect(() => {
    if (open) {
      startScanner()
    } else {
      stopScanner()
      setStatus('idle')
    }
    return () => stopScanner()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function switchCamera() {
    if (devices.length < 2) return
    const currentIndex = devices.findIndex((d) => d.deviceId === activeDeviceId)
    const next = devices[(currentIndex + 1) % devices.length]
    startScanner(next.deviceId)
  }

  function handleClose() {
    setOpen(false)
  }

  return (
    <>
      {/* Trigger button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label="Scan barcode with camera"
      >
        <Camera className="h-4 w-4" />
      </Button>

      {/* Scanner overlay */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-black/60">
            <span className="text-white text-sm font-medium">
              {status === 'requesting' && 'Starting camera...'}
              {status === 'scanning' && 'Point at a barcode'}
              {status === 'denied' && 'Permission denied'}
              {status === 'error' && 'Camera error'}
            </span>
            <div className="flex gap-2">
              {devices.length > 1 && status === 'scanning' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={switchCamera}
                  aria-label="Switch camera"
                >
                  <SwitchCamera className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={handleClose}
                aria-label="Close scanner"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Video feed */}
          {(status === 'requesting' || status === 'scanning') && (
            <div className="relative w-full max-w-sm aspect-square">
              <video
                ref={videoRef}
                className="w-full h-full object-cover rounded-lg"
                autoPlay
                muted
                playsInline
              />
              {/* Aim reticle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 border-2 border-white/70 rounded-lg relative">
                  {/* Corner accents */}
                  <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl" />
                  <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr" />
                  <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl" />
                  <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br" />
                  {/* Scan line animation */}
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-green-400/70 animate-scan-line" />
                </div>
              </div>
              {status === 'requesting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* Error / denied state */}
          {(status === 'denied' || status === 'error') && (
            <div className="flex flex-col items-center gap-4 px-6 text-center">
              <CameraOff className="h-12 w-12 text-red-400" />
              <p className="text-white text-sm">{errorMsg}</p>
              {status === 'error' && (
                <Button onClick={() => startScanner()} variant="outline" size="sm">
                  Retry
                </Button>
              )}
            </div>
          )}

          <p className="absolute bottom-8 text-white/50 text-xs">
            Tap × to close
          </p>
        </div>
      )}
    </>
  )
}
