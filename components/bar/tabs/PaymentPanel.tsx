import { useState } from 'react'
import { useBarStore } from '@/store/bar-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'

export function PaymentPanel() {
  const { activeTab, recordPayment, setTabStatus, closeTab } = useBarStore()
  const [method, setMethod] = useState<'cash'|'card'|'mobile_money'>('cash')
  const [amountGiven, setAmountGiven] = useState('')
  const [mpesaCode, setMpesaCode] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [loading, setLoading] = useState(false)
  
  if (!activeTab) return null

  const remaining = activeTab.remaining !== undefined ? activeTab.remaining : (activeTab.total - activeTab.amountPaid)

  const handlePay = async () => {
    if (remaining <= 0) return
    setLoading(true)
    try {
      if (activeTab.status !== 'billing') {
        await setTabStatus(activeTab._id, 'billing')
      }
      
      const payload: any = { amount: remaining, method }
      if (method === 'cash') payload.amountGiven = Number(amountGiven) || remaining
      if (method === 'mobile_money') {
        payload.mpesaCode = mpesaCode
        payload.mpesaPhone = mpesaPhone
      }
      
      await recordPayment(activeTab._id, payload)
      await closeTab(activeTab._id)
      
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (activeTab.status === 'paid') {
    return <div className="p-4 bg-green-50 text-green-700 text-center rounded-lg font-medium">Tab is fully paid.</div>
  }

  return (
    <div className="space-y-4 pt-4">
      <Tabs value={method} onValueChange={(v: any) => setMethod(v)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cash">Cash</TabsTrigger>
          <TabsTrigger value="mobile_money">M-Pesa</TabsTrigger>
          <TabsTrigger value="card">Card</TabsTrigger>
        </TabsList>
        <TabsContent value="cash" className="space-y-2 mt-4">
          <Label>Amount Given</Label>
          <Input 
            type="number" 
            placeholder={remaining.toString()}
            value={amountGiven}
            onChange={e => setAmountGiven(e.target.value)}
          />
          {Number(amountGiven) > remaining && (
            <p className="text-sm text-muted-foreground pt-1">
              Change: KES {(Number(amountGiven) - remaining).toLocaleString()}
            </p>
          )}
        </TabsContent>
        <TabsContent value="mobile_money" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>M-Pesa Code</Label>
            <Input value={mpesaCode} onChange={e => setMpesaCode(e.target.value)} placeholder="e.g. QWE123RTY" />
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} placeholder="07XX XXX XXX" />
          </div>
        </TabsContent>
      </Tabs>
      <Button className="w-full" size="lg" onClick={handlePay} disabled={loading || remaining <= 0}>
        {loading ? 'Processing...' : `Pay KES ${remaining.toLocaleString()}`}
      </Button>
    </div>
  )
}
