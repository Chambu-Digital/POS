'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductionLog {
  _id: string
  productionDate: string
  producedItemId: string
  producedItemName?: string
  servingTypeId?: string
  expectedYield: number
  actualYield: number
  variance: number
  variancePercentage: number
  ingredientsUsed: Array<{
    itemId: string
    itemName: string
    quantityUsed: number
    unit: string
  }>
  notes: string
  producedBy: string
  approvedBy?: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

interface MenuItem {
  _id: string
  name: string
  isServable: boolean
  servingTypes?: Array<{
    _id: string
    name: string
    servingsPerUnit: number
  }>
}

interface Ingredient {
  itemId: string
  itemName: string
  quantityUsed: number
  unit: string
}

export default function HospitalityProductionPage() {
  return (
    <PermissionGuard requiredPermission="hospitality.production">
      <ProductionContent />
    </PermissionGuard>
  )
}

function ProductionContent() {
  const [logs, setLogs] = useState<ProductionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  // Production form
  const [showForm, setShowForm] = useState(false)
  const [searchItem, setSearchItem] = useState('')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [selectedServing, setSelectedServing] = useState<string>('')
  const [expectedYield, setExpectedYield] = useState('')
  const [actualYield, setActualYield] = useState('')
  const [productionNotes, setProductionNotes] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Add ingredient
  const [showAddIngredient, setShowAddIngredient] = useState(false)
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [availableIngredients, setAvailableIngredients] = useState<MenuItem[]>([])
  const [selectedIngredient, setSelectedIngredient] = useState<MenuItem | null>(null)
  const [ingredientQty, setIngredientQty] = useState('')

  useEffect(() => {
    loadLogs()
  }, [statusFilter])

  async function loadLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('limit', '50')

      const res = await fetch(`/api/hospitality/production?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.productionLogs || [])
      } else {
        toast.error('Failed to load production logs')
      }
    } catch (error) {
      toast.error('Failed to load production logs')
    }
    setLoading(false)
  }

  // ── Production Form ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!showForm) return
    const timer = setTimeout(async () => {
      if (!searchItem) return
      const res = await fetch(`/api/hospitality/menu?search=${searchItem}&itemType=for-sale`)
      if (res.ok) {
        const data = await res.json()
        setMenuItems(data.menuItems || [])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchItem, showForm])

  useEffect(() => {
    if (!showAddIngredient) return
    const timer = setTimeout(async () => {
      if (!ingredientSearch) return
      const res = await fetch(`/api/hospitality/menu?search=${ingredientSearch}&itemType=ingredient`)
      if (res.ok) {
        const data = await res.json()
        setAvailableIngredients(data.menuItems || [])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [ingredientSearch, showAddIngredient])

  function addIngredientToList() {
    if (!selectedIngredient || !ingredientQty) {
      toast.error('Select ingredient and enter quantity')
      return
    }

    const newIngredient: Ingredient = {
      itemId: selectedIngredient._id,
      itemName: selectedIngredient.name,
      quantityUsed: parseFloat(ingredientQty),
      unit: (selectedIngredient as any).baseUnit || 'unit'
    }

    setIngredients([...ingredients, newIngredient])
    setShowAddIngredient(false)
    setSelectedIngredient(null)
    setIngredientQty('')
    setIngredientSearch('')
  }

  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  async function submitProduction() {
    if (!selectedItem || !expectedYield || !actualYield) {
      toast.error('Fill all required fields')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/hospitality/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producedItemId: selectedItem._id,
          servingTypeId: selectedServing || null,
          expectedYield: parseFloat(expectedYield),
          actualYield: parseFloat(actualYield),
          ingredientsUsed: ingredients,
          notes: productionNotes
        })
      })

      if (res.ok) {
        const data = await res.json()
        
        if (data.requiresApproval) {
          toast.success('Production logged - pending approval due to variance')
        } else {
          toast.success('Production logged successfully')
        }

        // Reset form
        setShowForm(false)
        setSelectedItem(null)
        setSelectedServing('')
        setExpectedYield('')
        setActualYield('')
        setProductionNotes('')
        setIngredients([])
        loadLogs()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to log production')
      }
    } catch (error) {
      toast.error('Failed to log production')
    }
    setSubmitting(false)
  }

  // ── Approve/Reject ────────────────────────────────────────────────────────

  async function approveProduction(logId: string) {
    if (!confirm('Approve this production log?')) return

    try {
      const res = await fetch(`/api/hospitality/production/${logId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      })

      if (res.ok) {
        toast.success('Production approved')
        loadLogs()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to approve')
      }
    } catch (error) {
      toast.error('Failed to approve production')
    }
  }

  async function rejectProduction(logId: string) {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return

    try {
      const res = await fetch(`/api/hospitality/production/${logId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejectionReason: reason })
      })

      if (res.ok) {
        toast.success('Production rejected')
        loadLogs()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to reject')
      }
    } catch (error) {
      toast.error('Failed to reject production')
    }
  }

  // ── Calculations ──────────────────────────────────────────────────────────

  const variance = selectedItem && expectedYield && actualYield
    ? parseFloat(actualYield) - parseFloat(expectedYield)
    : 0

  const variancePercentage = expectedYield && parseFloat(expectedYield) > 0
    ? (variance / parseFloat(expectedYield)) * 100
    : 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">Log production and track yield variance</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-2" />
          Log Production
        </Button>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm flex-1"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Production Logs */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading production logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No production logs found</p>
          <Button onClick={() => setShowForm(true)} className="mt-4">
            <Plus size={16} className="mr-2" />
            Log Your First Production
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const isHighVariance = Math.abs(log.variancePercentage) > 20
            
            return (
              <Card key={log._id} className={`hover:shadow-md transition ${
                log.status === 'pending' && isHighVariance ? 'border-orange-300' : ''
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{log.producedItemName}</h3>
                        <Badge className={
                          log.status === 'approved' ? 'bg-green-100 text-green-700' :
                          log.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {log.status}
                        </Badge>
                        {isHighVariance && (
                          <Badge variant="destructive">
                            <AlertTriangle size={12} className="mr-1" />
                            High Variance
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-gray-500">Expected Yield</p>
                          <p className="font-medium">{log.expectedYield} servings</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Actual Yield</p>
                          <p className="font-medium">{log.actualYield} servings</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Variance</p>
                          <div className="flex items-center gap-1">
                            {log.variance > 0 ? (
                              <TrendingUp size={16} className="text-green-600" />
                            ) : log.variance < 0 ? (
                              <TrendingDown size={16} className="text-red-600" />
                            ) : null}
                            <p className={`font-medium ${
                              log.variance > 0 ? 'text-green-600' :
                              log.variance < 0 ? 'text-red-600' :
                              'text-gray-900'
                            }`}>
                              {log.variance > 0 ? '+' : ''}{log.variance} ({log.variancePercentage.toFixed(1)}%)
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-500">Date</p>
                          <p className="font-medium">
                            {new Date(log.productionDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {log.ingredientsUsed && log.ingredientsUsed.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-gray-500 mb-1">Ingredients Used:</p>
                          <div className="flex flex-wrap gap-1">
                            {log.ingredientsUsed.map((ing, idx) => (
                              <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {ing.itemName}: {ing.quantityUsed} {ing.unit}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {log.notes && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Notes:</span> {log.notes}
                        </p>
                      )}
                    </div>

                    {log.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveProduction(log._id)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectProduction(log._id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── PRODUCTION FORM MODAL ────────────────────────────────────────── */}
      {showForm && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogTitle>Log Production</DialogTitle>
            
            <div className="space-y-4 mt-2">
              {/* Select Item */}
              <div>
                <label className="text-sm font-medium block mb-2">Item Produced *</label>
                <Input
                  placeholder="Search item..."
                  value={searchItem}
                  onChange={(e) => setSearchItem(e.target.value)}
                />
                {searchItem && menuItems.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                    {menuItems.map((item) => (
                      <button
                        key={item._id}
                        onClick={() => {
                          setSelectedItem(item)
                          setSearchItem('')
                          if (item.isServable && item.servingTypes && item.servingTypes.length === 1) {
                            setSelectedServing(item.servingTypes[0]._id)
                          }
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-0"
                      >
                        <p className="font-medium">{item.name}</p>
                        {item.isServable && (
                          <p className="text-xs text-gray-500">
                            {item.servingTypes?.length || 0} serving types
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedItem && (
                <>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="font-semibold">{selectedItem.name}</p>
                  </div>

                  {/* Serving Type (if servable) */}
                  {selectedItem.isServable && selectedItem.servingTypes && selectedItem.servingTypes.length > 1 && (
                    <div>
                      <label className="text-sm font-medium block mb-2">Serving Type</label>
                      <select
                        value={selectedServing}
                        onChange={(e) => setSelectedServing(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">Select serving type</option>
                        {selectedItem.servingTypes.map((st) => (
                          <option key={st._id} value={st._id}>
                            {st.name} ({st.servingsPerUnit} per unit)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Yields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium block mb-2">Expected Yield *</label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={expectedYield}
                        onChange={(e) => setExpectedYield(e.target.value)}
                        placeholder="Number of servings"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-2">Actual Yield *</label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={actualYield}
                        onChange={(e) => setActualYield(e.target.value)}
                        placeholder="Number of servings"
                      />
                    </div>
                  </div>

                  {/* Variance Display */}
                  {expectedYield && actualYield && (
                    <div className={`p-3 rounded-lg ${
                      Math.abs(variancePercentage) > 20 ? 'bg-orange-50 border border-orange-200' :
                      variance > 0 ? 'bg-green-50' :
                      variance < 0 ? 'bg-red-50' :
                      'bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Variance</span>
                        <span className={`text-lg font-bold ${
                          variance > 0 ? 'text-green-600' :
                          variance < 0 ? 'text-red-600' :
                          'text-gray-900'
                        }`}>
                          {variance > 0 ? '+' : ''}{variance} ({variancePercentage.toFixed(1)}%)
                        </span>
                      </div>
                      {Math.abs(variancePercentage) > 20 && (
                        <p className="text-xs text-orange-700 mt-1">
                          <AlertTriangle size={12} className="inline mr-1" />
                          High variance - will require approval
                        </p>
                      )}
                    </div>
                  )}

                  {/* Ingredients */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Ingredients Used (Optional)</label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddIngredient(true)}
                      >
                        <Plus size={14} className="mr-1" />
                        Add
                      </Button>
                    </div>

                    {ingredients.length > 0 && (
                      <div className="space-y-2">
                        {ingredients.map((ing, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm">
                              {ing.itemName}: {ing.quantityUsed} {ing.unit}
                            </span>
                            <button
                              onClick={() => removeIngredient(idx)}
                              className="text-red-600 hover:text-red-700 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-medium block mb-2">Notes (Optional)</label>
                    <textarea
                      value={productionNotes}
                      onChange={(e) => setProductionNotes(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={2}
                      placeholder="Any additional notes about this production..."
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowForm(false)
                        setSelectedItem(null)
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={submitProduction}
                      disabled={submitting}
                      className="flex-1"
                    >
                      {submitting ? 'Submitting...' : 'Log Production'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── ADD INGREDIENT MODAL ─────────────────────────────────────────── */}
      {showAddIngredient && (
        <Dialog open={showAddIngredient} onOpenChange={setShowAddIngredient}>
          <DialogContent>
            <DialogTitle>Add Ingredient</DialogTitle>
            
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium block mb-2">Search Ingredient</label>
                <Input
                  placeholder="Search ingredient..."
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                />
                {ingredientSearch && availableIngredients.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                    {availableIngredients.map((item) => (
                      <button
                        key={item._id}
                        onClick={() => {
                          setSelectedIngredient(item)
                          setIngredientSearch('')
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-0"
                      >
                        <p className="font-medium">{item.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedIngredient && (
                <>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-semibold">{selectedIngredient.name}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">Quantity Used</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ingredientQty}
                      onChange={(e) => setIngredientQty(e.target.value)}
                      placeholder="Enter quantity"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddIngredient(false)
                        setSelectedIngredient(null)
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button onClick={addIngredientToList} className="flex-1">
                      Add Ingredient
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
