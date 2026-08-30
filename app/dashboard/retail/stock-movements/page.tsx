'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Search, Calendar, TrendingUp, TrendingDown, Package, AlertCircle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { RecordMovementModal } from '@/components/inventory/record-movement-modal'

interface StockMovement {
  _id: string
  type: string
  timestamp: string
  productId?: {
    _id: string
    productName: string
  }
  supplierId?: {
    _id: string
    name: string
  }
  staffId?: {
    _id: string
    name: string
  }
  quantity: number
  previousStock: number
  newStock: number
  unitCost?: number
  totalCost?: number
  reference?: string
  reason?: string
  notes?: string
  orderNumber?: string
  supplierName?: string
}

type MovementType = 'all' | 'STOCK_IN' | 'SALE' | 'RETURN' | 'DAMAGE' | 'WASTAGE' | 'EXPIRED' | 'LOSS' | 'ADJUSTMENT'

const MOVEMENT_TYPES: { value: MovementType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'STOCK_IN', label: 'Stock In' },
  { value: 'SALE', label: 'Sales' },
  { value: 'RETURN', label: 'Returns' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'WASTAGE', label: 'Wastage' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'LOSS', label: 'Loss' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
]

export default function StockMovementsPage() {
  return (
    <PermissionGuard requiredPermission="pos.stock-movements">
      <StockMovementsPageContent />
    </PermissionGuard>
  )
}

function StockMovementsPageContent() {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<MovementType>('all')
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isRecordMovementOpen, setIsRecordMovementOpen] = useState(false)

  useEffect(() => {
    fetchMovements()
  }, [activeType, search])

  async function fetchMovements() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeType !== 'all') params.append('type', activeType)
      if (search) params.append('search', search)
      params.append('limit', '200')

      const response = await fetch(`/api/inventory/stock-ledger?${params}`)
      if (response.ok) {
        const data = await response.json()
        setMovements(data.ledger || [])
      }
    } catch (error) {
      toast.error('Failed to load stock movements')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function getMovementIcon(type: string) {
    switch (type) {
      case 'STOCK_IN':
        return <TrendingUp size={16} className="text-green-600" />
      case 'SALE':
        return <TrendingDown size={16} className="text-blue-600" />
      case 'RETURN':
        return <TrendingUp size={16} className="text-purple-600" />
      case 'DAMAGE':
      case 'WASTAGE':
      case 'EXPIRED':
      case 'LOSS':
        return <AlertCircle size={16} className="text-red-600" />
      case 'ADJUSTMENT':
        return <Package size={16} className="text-orange-600" />
      default:
        return <Package size={16} className="text-gray-600" />
    }
  }

  function getMovementColor(type: string) {
    switch (type) {
      case 'STOCK_IN':
        return 'bg-green-100 text-green-800'
      case 'SALE':
        return 'bg-blue-100 text-blue-800'
      case 'RETURN':
        return 'bg-purple-100 text-purple-800'
      case 'DAMAGE':
      case 'WASTAGE':
      case 'EXPIRED':
      case 'LOSS':
        return 'bg-red-100 text-red-800'
      case 'ADJUSTMENT':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  function getMovementLabel(type: string) {
    return MOVEMENT_TYPES.find(t => t.value === type)?.label || type
  }

  function formatQuantity(quantity: number, type: string) {
    if (quantity > 0) {
      return <span className="text-green-600 font-semibold">+{quantity}</span>
    } else if (quantity < 0) {
      return <span className="text-red-600 font-semibold">{quantity}</span>
    }
    return <span className="text-gray-600">{quantity}</span>
  }

  function openDetailModal(movement: StockMovement) {
    setSelectedMovement(movement)
    setIsDetailOpen(true)
  }

  // Calculate stats
  const stockInCount = movements.filter(m => m.type === 'STOCK_IN').length
  const saleCount = movements.filter(m => m.type === 'SALE').length
  const issueCount = movements.filter(m => ['DAMAGE', 'WASTAGE', 'EXPIRED', 'LOSS'].includes(m.type)).length

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Movements</h1>
          <p className="text-muted-foreground mt-2">View complete stock movement history</p>
        </div>
        <Button
          onClick={() => setIsRecordMovementOpen(true)}
          size="lg"
        >
          <Plus size={20} className="mr-2" />
          Record Movement
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Movements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movements.length}</div>
            <p className="text-sm text-muted-foreground">Recent transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp size={16} className="text-green-600" />
              Stock In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stockInCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown size={16} className="text-blue-600" />
              Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{saleCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600" />
              Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{issueCount}</div>
            <p className="text-xs text-muted-foreground">Damage, Wastage, Expired, Loss</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Search by product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Movement Types Tabs */}
      <Tabs value={activeType} onValueChange={(v) => setActiveType(v as MovementType)} className="space-y-4">
        <TabsList className="grid grid-cols-9 w-full">
          {MOVEMENT_TYPES.map((type) => (
            <TabsTrigger key={type.value} value={type.value}>
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeType} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Movement History</CardTitle>
              <CardDescription>
                {activeType === 'all' 
                  ? 'All stock movements'
                  : `${getMovementLabel(activeType)} movements`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading movements...</div>
              ) : movements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {search ? 'No movements found matching your search.' : 'No movements recorded yet.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Before</TableHead>
                        <TableHead>After</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Staff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map((movement) => (
                        <TableRow
                          key={movement._id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openDetailModal(movement)}
                        >
                          <TableCell className="whitespace-nowrap">
                            {new Date(movement.timestamp).toLocaleDateString()}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {new Date(movement.timestamp).toLocaleTimeString()}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            {movement.productId?.productName || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge className={getMovementColor(movement.type)}>
                              <span className="flex items-center gap-1">
                                {getMovementIcon(movement.type)}
                                {getMovementLabel(movement.type)}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatQuantity(movement.quantity, movement.type)}
                          </TableCell>
                          <TableCell>{movement.previousStock}</TableCell>
                          <TableCell className="font-semibold">{movement.newStock}</TableCell>
                          <TableCell>
                            {movement.supplierId?.name || movement.supplierName || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {movement.reference || movement.orderNumber || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {movement.staffId?.name || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Movement Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Movement Details</DialogTitle>
            <DialogDescription>
              Complete information about this stock movement
            </DialogDescription>
          </DialogHeader>

          {selectedMovement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date & Time</p>
                  <p className="text-base">
                    {new Date(selectedMovement.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Movement Type</p>
                  <Badge className={getMovementColor(selectedMovement.type)}>
                    <span className="flex items-center gap-1">
                      {getMovementIcon(selectedMovement.type)}
                      {getMovementLabel(selectedMovement.type)}
                    </span>
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Product</p>
                <p className="text-lg font-semibold">
                  {selectedMovement.productId?.productName || 'Unknown'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Quantity</p>
                  <p className="text-2xl font-bold">
                    {formatQuantity(selectedMovement.quantity, selectedMovement.type)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Previous Stock</p>
                  <p className="text-2xl font-bold">{selectedMovement.previousStock}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">New Stock</p>
                  <p className="text-2xl font-bold text-primary">{selectedMovement.newStock}</p>
                </div>
              </div>

              {(selectedMovement.unitCost || selectedMovement.totalCost) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedMovement.unitCost && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Unit Cost</p>
                      <p className="text-base font-semibold">
                        KSh {selectedMovement.unitCost.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {selectedMovement.totalCost && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                      <p className="text-base font-semibold">
                        KSh {selectedMovement.totalCost.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {(selectedMovement.supplierId || selectedMovement.supplierName) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Supplier</p>
                  <p className="text-base">
                    {selectedMovement.supplierId?.name || selectedMovement.supplierName}
                  </p>
                </div>
              )}

              {(selectedMovement.reference || selectedMovement.orderNumber) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reference</p>
                  <p className="text-base font-mono">
                    {selectedMovement.reference || selectedMovement.orderNumber}
                  </p>
                </div>
              )}

              {selectedMovement.staffId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Performed By</p>
                  <p className="text-base">{selectedMovement.staffId.name}</p>
                </div>
              )}

              {selectedMovement.reason && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reason</p>
                  <p className="text-base">{selectedMovement.reason}</p>
                </div>
              )}

              {selectedMovement.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p className="text-base whitespace-pre-wrap">{selectedMovement.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Movement Modal */}
      <RecordMovementModal
        open={isRecordMovementOpen}
        onOpenChange={setIsRecordMovementOpen}
        onSuccess={() => {
          setIsRecordMovementOpen(false)
          fetchMovements()
        }}
      />
    </div>
  )
}
