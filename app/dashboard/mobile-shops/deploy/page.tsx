'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Store,
  MapPin,
  Package,
  Users,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

interface Branch {
  _id: string
  name: string
  code: string
}

interface Product {
  _id: string
  productName: string
  variant?: string
  brand?: string
  stock: number
  sellingPrice: number
}

interface StockItem {
  productId: string
  productName: string
  quantity: number
  available: number
}

interface TempSeller {
  name: string
  email: string
  phone: string
}

interface Credential {
  name: string
  username: string
  pin: string
  sellerId: string
}

export default function DeployMobileShopPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [shopName, setShopName] = useState('')
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [tempSellers, setTempSellers] = useState<TempSeller[]>([{ name: '', email: '', phone: '' }])
  const [productSearch, setProductSearch] = useState('')
  const [notes, setNotes] = useState('')
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [deployedShopId, setDeployedShopId] = useState<string>('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchBranches()
  }, [])

  useEffect(() => {
    if (selectedBranch) {
      fetchProducts(selectedBranch)
    }
  }, [selectedBranch])

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches')
      const data = await res.json()
      setBranches(data.branches || [])
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const fetchProducts = async (branchId: string) => {
    try {
      const res = await fetch(`/api/products?branchId=${branchId}`)
      const data = await res.json()
      // Filter products with stock > 0
      const available = (data.products || []).filter((p: Product) => p.stock > 0)
      setProducts(available)
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const addStockItem = (product: Product) => {
    if (stockItems.find(item => item.productId === product._id)) {
      setError('Product already added')
      return
    }
    setStockItems([
      ...stockItems,
      {
        productId: product._id,
        productName: `${product.productName}${product.variant ? ` - ${product.variant}` : ''}`,
        quantity: 1,
        available: product.stock,
      },
    ])
    setProductSearch('')
  }

  const updateStockQuantity = (productId: string, quantity: number) => {
    setStockItems(
      stockItems.map(item =>
        item.productId === productId
          ? { ...item, quantity: Math.min(quantity, item.available) }
          : item
      )
    )
  }

  const removeStockItem = (productId: string) => {
    setStockItems(stockItems.filter(item => item.productId !== productId))
  }

  const addTempSeller = () => {
    setTempSellers([...tempSellers, { name: '', email: '', phone: '' }])
  }

  const updateTempSeller = (index: number, field: keyof TempSeller, value: string) => {
    setTempSellers(
      tempSellers.map((seller, i) =>
        i === index ? { ...seller, [field]: value } : seller
      )
    )
  }

  const removeTempSeller = (index: number) => {
    if (tempSellers.length > 1) {
      setTempSellers(tempSellers.filter((_, i) => i !== index))
    }
  }

  const validateStep1 = () => {
    if (!selectedBranch) {
      setError('Please select a source branch')
      return false
    }
    if (!shopName.trim()) {
      setError('Please enter a shop name')
      return false
    }
    setError('')
    return true
  }

  const validateStep2 = () => {
    if (stockItems.length === 0) {
      setError('Please add at least one product')
      return false
    }
    const invalidQty = stockItems.find(item => item.quantity <= 0 || item.quantity > item.available)
    if (invalidQty) {
      setError('Please check product quantities')
      return false
    }
    setError('')
    return true
  }

  const validateStep3 = () => {
    const validSellers = tempSellers.filter(s => s.name.trim())
    if (validSellers.length === 0) {
      setError('Please add at least one temp seller')
      return false
    }
    // Check for duplicate names
    const names = validSellers.map(s => s.name.toLowerCase().trim())
    if (names.length !== new Set(names).size) {
      setError('Duplicate seller names found')
      return false
    }
    setError('')
    return true
  }

  const handleDeploy = async () => {
    if (!validateStep3()) return

    try {
      setLoading(true)
      setError('')

      const validSellers = tempSellers.filter(s => s.name.trim())

      const res = await fetch('/api/mobile-shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: shopName,
          sourceBranchId: selectedBranch,
          stockOut: stockItems.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
          })),
          tempSellers: validSellers,
          notes,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to deploy mobile shop')
      }

      setCredentials(data.credentials || [])
      setDeployedShopId(data.shop._id)
      setStep(4) // Success step
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p =>
    p.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.variant?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.brand?.toLowerCase().includes(productSearch.toLowerCase())
  )

  const selectedBranchName = branches.find(b => b._id === selectedBranch)?.name || ''

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Store className="h-6 w-6" />
          Deploy Mobile Shop
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Set up field sales with stock and temp sellers
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-between">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                s < step
                  ? 'bg-green-600 text-white'
                  : s === step
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {s < step ? <CheckCircle2 className="h-5 w-5" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  s < step ? 'bg-green-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="flex-1 text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Step 1: Basic Info & Branch */}
      {step === 1 && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Basic Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Shop Name *</label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g., Market Day - Gikomba"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Source Branch *</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Stock will be deducted from this branch
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Location, target area, special instructions..."
                className="w-full border rounded-lg px-3 py-2 h-20 resize-none"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => {
                if (validateStep1()) setStep(2)
              }}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Next: Add Stock
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Stock Allocation */}
      {step === 2 && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock Allocation
          </h2>

          {/* Product Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full border rounded-lg pl-10 pr-3 py-2"
              />
            </div>

            {/* Search Results Dropdown */}
            {productSearch && (
              <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    No products found
                  </div>
                ) : (
                  filteredProducts.slice(0, 10).map((product) => (
                    <div
                      key={product._id}
                      onClick={() => addStockItem(product)}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    >
                      <div className="font-medium text-sm">
                        {product.productName}
                        {product.variant && ` - ${product.variant}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        Stock: {product.stock} | KES {product.sellingPrice.toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Stock Items */}
          <div className="space-y-3 mb-4">
            {stockItems.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.productName}</div>
                  <div className="text-xs text-gray-500">
                    Available: {item.available}
                  </div>
                </div>
                <input
                  type="number"
                  min="1"
                  max={item.available}
                  value={item.quantity}
                  onChange={(e) =>
                    updateStockQuantity(item.productId, parseInt(e.target.value) || 1)
                  }
                  className="w-20 border rounded px-2 py-1 text-center"
                />
                <button
                  onClick={() => removeStockItem(item.productId)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {stockItems.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Search and add products to deploy
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="border px-6 py-2 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (validateStep2()) setStep(3)
              }}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Next: Add Sellers
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Temp Sellers */}
      {step === 3 && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Temporary Sellers
          </h2>

          <div className="space-y-3 mb-4">
            {tempSellers.map((seller, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      value={seller.name}
                      onChange={(e) => updateTempSeller(index, 'name', e.target.value)}
                      placeholder="Full Name *"
                      className="w-full border rounded px-3 py-2"
                    />
                    <input
                      type="email"
                      value={seller.email}
                      onChange={(e) => updateTempSeller(index, 'email', e.target.value)}
                      placeholder="Email (optional)"
                      className="w-full border rounded px-3 py-2"
                    />
                    <input
                      type="tel"
                      value={seller.phone}
                      onChange={(e) => updateTempSeller(index, 'phone', e.target.value)}
                      placeholder="Phone (optional)"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  {tempSellers.length > 1 && (
                    <button
                      onClick={() => removeTempSeller(index)}
                      className="text-red-600 hover:text-red-700 mt-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addTempSeller}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-gray-600 hover:border-blue-500 hover:text-blue-600 flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Another Seller
          </button>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="border px-6 py-2 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleDeploy}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Deploying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Deploy Shop
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success & Credentials */}
      {step === 4 && (
        <div className="bg-white border rounded-lg p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Mobile Shop Deployed!</h2>
            <p className="text-gray-600">
              {shopName} is now active with {credentials.length} seller(s)
            </p>
          </div>

          {/* Credentials */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Seller Credentials</h3>
            <div className="space-y-3">
              {credentials.map((cred, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                  <div className="font-medium mb-2">{cred.name}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Username:</span>
                      <span className="ml-2 font-mono font-semibold">{cred.username}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">PIN:</span>
                      <span className="ml-2 font-mono font-semibold">{cred.pin}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              ⚠️ Save these credentials - sellers need them to log in
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/dashboard/mobile-shops/${deployedShopId}`)}
              className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              View Shop Details
            </button>
            <button
              onClick={() => router.push('/dashboard/mobile-shops')}
              className="flex-1 border px-6 py-2 rounded-lg hover:bg-gray-50"
            >
              Back to List
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
