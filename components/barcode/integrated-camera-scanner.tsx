'use client'

// ─── IntegratedCameraScanner ───────────────────────────────────────────────────
// Mobile camera barcode scanning with integrated cart view.
// Camera shows at top 25%, cart items below, allowing live editing while scanning.

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Camera, CameraOff, SwitchCamera, X, Plus, Minus, ShoppingBag } from 'lucide-react'

const DEVICE_KEY = 'barcode_camera_deviceId'

interface CartItem {
  productId: string
  productName: string
  brand?: string
  model?: string
  variant?: string
  sellingPrice: number
  quantity: number
  discount: number
}

interface Props {
  onScan: (code: string) => void
  disabled?: boolean
  // Cart integration props
  cart: CartItem[]
  cartDiscount: number
  onUpdateQuantity: (productId: string, quantity: number) => void
  onUpdateDiscount: (productId: string, discount: number) => void
  onRemoveFromCart: (productId: string) => void
  onUpdateCartDiscount: (discount: number) => void
  onCompleteSale: () => void
  onEnterEditing?: () => void
  onExitEditing?: () => void
}

type ScannerStatus = 'idle' | 'requesting' | 'scanning' | 'denied' | 'error'

export function IntegratedCameraScanner({ 
  onScan, 
  disabled,
  cart,
  cartDiscount,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemoveFromCart,
  onUpdateCartDiscount,
  onCompleteSale,
  onEnterEditing,
  onExitEditing,
}: Props) {
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
            console.warn('[IntegratedCameraScanner]', err)
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

  function formatProductName(item: { productName: string; brand?: string; variant?: string }) {
    return [item.variant, item.brand, item.productName].filter(Boolean).join(' ')
  }

  const subtotal = cart.reduce(
    (sum, item) => sum + item.sellingPrice * item.quantity - item.discount,
    0
  )
  const total = subtotal - cartDiscount

  return (
    <>
      {/* Trigger button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label="Scan with camera and view cart"
        className="gap-2"
      >
        <Camera className="h-4 w-4" />
        <span className="text-xs">Scan & Cart</span>
      </Button>

      {/* Scanner + Cart View */}
      {open && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Camera Section - Fixed Top ~25% */}
          <div className="relative bg-black" style={{ height: '25vh', minHeight: '180px' }}>
            {/* Camera Header */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-black/60 z-10">
              <span className="text-white text-xs font-medium">
                {status === 'requesting' && 'Starting camera...'}
                {status === 'scanning' && 'Point at barcode'}
                {status === 'denied' && 'Permission denied'}
                {status === 'error' && 'Camera error'}
              </span>
              <div className="flex gap-1">
                {devices.length > 1 && status === 'scanning' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20 h-7 w-7 p-0"
                    onClick={switchCamera}
                    aria-label="Switch camera"
                  >
                    <SwitchCamera className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20 h-7 w-7 p-0"
                  onClick={handleClose}
                  aria-label="Close scanner"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Video Feed */}
            {(status === 'requesting' || status === 'scanning') && (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                {/* Compact Aim Reticle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-40 h-20 border-2 border-white/70 rounded-lg relative">
                    <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-400 rounded-tl" />
                    <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-400 rounded-tr" />
                    <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-400 rounded-bl" />
                    <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-400 rounded-br" />
                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-green-400/70 animate-scan-line" />
                  </div>
                </div>
                {status === 'requesting' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            )}

            {/* Error / Denied State */}
            {(status === 'denied' || status === 'error') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
                <CameraOff className="h-10 w-10 text-red-400" />
                <p className="text-white text-xs">{errorMsg}</p>
                {status === 'error' && (
                  <Button onClick={() => startScanner()} variant="outline" size="sm" className="h-7 text-xs">
                    Retry
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Cart Section - Scrollable Bottom ~75% */}
          <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
            {/* Cart Header */}
            <div className="bg-white border-b px-4 py-2.5 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100">
                <ShoppingBag size={16} className="text-emerald-600" />
              </span>
              <div>
                <h3 className="font-semibold text-sm">Scanned Items</h3>
                <p className="text-xs text-muted-foreground">
                  {cart.length} {cart.length === 1 ? 'item' : 'items'} • KSh {total.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Cart Items - Scrollable */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-2 py-8">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <ShoppingBag size={28} className="text-gray-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">No items scanned yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Point camera at barcode to add</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.productId} className="bg-white border rounded-lg p-2.5 shadow-sm">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-semibold text-xs leading-tight">
                            {formatProductName(item)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            KSh {item.sellingPrice.toLocaleString()} each
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => onRemoveFromCart(item.productId)}
                        >
                          <X size={14} />
                        </Button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                          >
                            <Minus size={12} />
                          </Button>
                          <Input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => onUpdateQuantity(item.productId, parseInt(e.target.value) || 0)}
                            onFocus={(e) => {
                              e.target.select()
                              onEnterEditing?.()
                            }}
                            onBlur={onExitEditing}
                            className="w-10 h-7 text-center text-xs p-0 font-medium"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                          >
                            <Plus size={12} />
                          </Button>
                        </div>

                        {/* Discount */}
                        <Input
                          type="number"
                          placeholder="Disc"
                          value={item.discount || ''}
                          onChange={(e) => onUpdateDiscount(item.productId, parseFloat(e.target.value) || 0)}
                          onFocus={(e) => {
                            e.target.select()
                            onEnterEditing?.()
                          }}
                          onBlur={onExitEditing}
                          className="flex-1 h-7 text-xs"
                        />

                        {/* Item Total */}
                        <div className="text-right min-w-[60px]">
                          <p className="text-xs font-bold whitespace-nowrap text-primary">
                            KSh {(item.sellingPrice * item.quantity - item.discount).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Summary & Actions - Fixed Bottom */}
            {cart.length > 0 && (
              <div className="bg-white border-t px-4 py-3 space-y-3">
                {/* Summary */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">KSh {subtotal.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="cart-discount" className="text-xs text-muted-foreground">
                      Cart Discount:
                    </Label>
                    <Input
                      id="cart-discount"
                      type="number"
                      placeholder="0.00"
                      value={cartDiscount || ''}
                      onChange={(e) => onUpdateCartDiscount(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => {
                        e.target.select()
                        onEnterEditing?.()
                      }}
                      onBlur={onExitEditing}
                      className="h-7 w-20 text-xs text-right"
                    />
                  </div>
                  
                  <Separator className="my-1.5" />
                  
                  <div className="flex justify-between text-sm font-bold">
                    <span>Total:</span>
                    <span className="text-primary">KSh {Math.max(0, total).toLocaleString()}</span>
                  </div>
                </div>

                {/* Complete Sale Button */}
                <Button
                  onClick={onCompleteSale}
                  className="w-full h-11 text-sm font-semibold"
                  size="lg"
                >
                  Complete Sale
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
