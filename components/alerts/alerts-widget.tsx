'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, TrendingDown, Users } from 'lucide-react'
import { toast } from 'sonner'

interface AlertData {
  lowStockCount: number
  lowStockEstimatedCost: number
  customersWithDebt: number
  highDebtCustomers: Array<{
    name: string
    phone?: string
    creditBalance: number
  }>
}

export function AlertsWidget() {
  const [alerts, setAlerts] = useState<AlertData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAlerts()
  }, [])

  async function fetchAlerts() {
    try {
      // Fetch low stock items
      const lowStockRes = await fetch('/api/restocking/low-stock')
      const lowStockData = lowStockRes.ok ? await lowStockRes.json() : null

      // Fetch high debt customers
      const customersRes = await fetch('/api/customers')
      const customersData = customersRes.ok ? await customersRes.json() : null

      const customers = customersData?.customers || []
      const highDebtCustomers = customers
        .filter((c: any) => c.creditBalance > 0)
        .sort((a: any, b: any) => b.creditBalance - a.creditBalance)
        .slice(0, 5)

      setAlerts({
        lowStockCount: lowStockData?.pagination?.totalLowStock || 0,
        lowStockEstimatedCost: lowStockData?.statistics?.estimatedCost || 0,
        customersWithDebt: customers.filter((c: any) => c.creditBalance > 0).length,
        highDebtCustomers,
      })
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Alerts & Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  if (!alerts) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {/* Low Stock Alert */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-5 w-5 text-amber-600" />
            Low Stock Items
          </CardTitle>
          <CardDescription>Items below threshold</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-amber-600">{alerts.lowStockCount}</div>
            <p className="text-sm text-muted-foreground">
              Estimated restock cost: KES {alerts.lowStockEstimatedCost.toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Customer Debt Alert */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-red-600" />
            Customers with Debt
          </CardTitle>
          <CardDescription>Outstanding balances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-3xl font-bold text-red-600">{alerts.customersWithDebt}</div>
            {alerts.highDebtCustomers.length > 0 && (
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-gray-700">Top debtors:</p>
                {alerts.highDebtCustomers.map((customer) => (
                  <div key={customer.name} className="flex justify-between text-xs">
                    <span>{customer.name}</span>
                    <span className="font-medium">KES {customer.creditBalance.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
