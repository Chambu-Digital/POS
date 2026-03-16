'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Store,
  Bell,
  CreditCard,
  Receipt,
  Shield,
  Palette,
  Save,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

interface ShopSettings {
  shopName: string
  email: string
  phone: string
  address: string
  taxId: string
  currency: string
  timezone: string
  receiptFooter: string
  logo?: string
}

interface NotificationSettings {
  emailNotifications: boolean
  smsNotifications: boolean
  lowStockAlerts: boolean
  dailySalesReport: boolean
  newOrderNotification: boolean
}

interface PaymentSettings {
  enableCash: boolean
  enableCard: boolean
  enableMpesa: boolean
  mpesaPaybill: string
  mpesaAccountNumber: string
  taxRate: number
}

interface ReceiptSettings {
  showLogo: boolean
  showTaxId: boolean
  showAddress: boolean
  showPhone: boolean
  customMessage: string
  paperSize: '58mm' | '80mm' | 'A4'
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('shop')

  // Settings state
  const [shopSettings, setShopSettings] = useState<ShopSettings>({
    shopName: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    currency: 'KES',
    timezone: 'Africa/Nairobi',
    receiptFooter: 'Thank you for your business!',
  })

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    smsNotifications: false,
    lowStockAlerts: true,
    dailySalesReport: false,
    newOrderNotification: true,
  })

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    enableCash: true,
    enableCard: false,
    enableMpesa: true,
    mpesaPaybill: '',
    mpesaAccountNumber: '',
    taxRate: 16,
  })

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>({
    showLogo: true,
    showTaxId: true,
    showAddress: true,
    showPhone: true,
    customMessage: 'Thank You For Shopping With Us!',
    paperSize: '58mm',
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        if (data.settings) {
          setShopSettings(data.settings.shop || shopSettings)
          setNotificationSettings(data.settings.notifications || notificationSettings)
          setPaymentSettings(data.settings.payment || paymentSettings)
          setReceiptSettings(data.settings.receipt || receiptSettings)
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings() {
    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop: shopSettings,
          notifications: notificationSettings,
          payment: paymentSettings,
          receipt: receiptSettings,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your shop settings and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="shop">
            <Store className="h-4 w-4 mr-2" />
            Shop
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="payment">
            <CreditCard className="h-4 w-4 mr-2" />
            Payment
          </TabsTrigger>
          <TabsTrigger value="receipt">
            <Receipt className="h-4 w-4 mr-2" />
            Receipt
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Shop Settings */}
        <TabsContent value="shop" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shop Information</CardTitle>
              <CardDescription>Update your shop details and business information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shopName">Shop Name</Label>
                  <Input
                    id="shopName"
                    value={shopSettings.shopName}
                    onChange={(e) => setShopSettings({ ...shopSettings, shopName: e.target.value })}
                    placeholder="My Shop"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={shopSettings.email}
                    onChange={(e) => setShopSettings({ ...shopSettings, email: e.target.value })}
                    placeholder="shop@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={shopSettings.phone}
                    onChange={(e) => setShopSettings({ ...shopSettings, phone: e.target.value })}
                    placeholder="+254 712 345 678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID / PIN</Label>
                  <Input
                    id="taxId"
                    value={shopSettings.taxId}
                    onChange={(e) => setShopSettings({ ...shopSettings, taxId: e.target.value })}
                    placeholder="P051234567X"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={shopSettings.address}
                  onChange={(e) => setShopSettings({ ...shopSettings, address: e.target.value })}
                  placeholder="Shop address"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={shopSettings.currency}
                    onValueChange={(value) => setShopSettings({ ...shopSettings, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={shopSettings.timezone}
                    onValueChange={(value) => setShopSettings({ ...shopSettings, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Africa/Nairobi">East Africa Time (EAT)</SelectItem>
                      <SelectItem value="Africa/Lagos">West Africa Time (WAT)</SelectItem>
                      <SelectItem value="Africa/Cairo">Egypt Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiptFooter">Receipt Footer Message</Label>
                <Input
                  id="receiptFooter"
                  value={shopSettings.receiptFooter}
                  onChange={(e) => setShopSettings({ ...shopSettings, receiptFooter: e.target.value })}
                  placeholder="Thank you for your business!"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Manage how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.emailNotifications}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, emailNotifications: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via SMS
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.smsNotifications}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, smsNotifications: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Low Stock Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when products are running low
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.lowStockAlerts}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, lowStockAlerts: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Sales Report</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive daily sales summary
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.dailySalesReport}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, dailySalesReport: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Order Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified for each new order
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.newOrderNotification}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, newOrderNotification: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Configure accepted payment methods</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cash Payments</Label>
                  <p className="text-sm text-muted-foreground">
                    Accept cash payments
                  </p>
                </div>
                <Switch
                  checked={paymentSettings.enableCash}
                  onCheckedChange={(checked) =>
                    setPaymentSettings({ ...paymentSettings, enableCash: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Card Payments</Label>
                  <p className="text-sm text-muted-foreground">
                    Accept card payments
                  </p>
                </div>
                <Switch
                  checked={paymentSettings.enableCard}
                  onCheckedChange={(checked) =>
                    setPaymentSettings({ ...paymentSettings, enableCard: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>M-Pesa Payments</Label>
                  <p className="text-sm text-muted-foreground">
                    Accept M-Pesa payments
                  </p>
                </div>
                <Switch
                  checked={paymentSettings.enableMpesa}
                  onCheckedChange={(checked) =>
                    setPaymentSettings({ ...paymentSettings, enableMpesa: checked })
                  }
                />
              </div>

              {paymentSettings.enableMpesa && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mpesaPaybill">M-Pesa Paybill Number</Label>
                      <Input
                        id="mpesaPaybill"
                        value={paymentSettings.mpesaPaybill}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, mpesaPaybill: e.target.value })
                        }
                        placeholder="Your paybill"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mpesaAccount">Account Number</Label>
                      <Input
                        id="mpesaAccount"
                        value={paymentSettings.mpesaAccountNumber}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, mpesaAccountNumber: e.target.value })
                        }
                        placeholder="Your account"
                      />
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  value={paymentSettings.taxRate}
                  onChange={(e) =>
                    setPaymentSettings({ ...paymentSettings, taxRate: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="16"
                  step="0.01"
                />
                <p className="text-sm text-muted-foreground">
                  VAT/Tax rate applied to sales (Kenya VAT is 16%)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receipt Settings */}
        <TabsContent value="receipt" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Configuration</CardTitle>
              <CardDescription>Customize your receipt appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Logo</Label>
                  <p className="text-sm text-muted-foreground">
                    Display shop logo on receipts
                  </p>
                </div>
                <Switch
                  checked={receiptSettings.showLogo}
                  onCheckedChange={(checked) =>
                    setReceiptSettings({ ...receiptSettings, showLogo: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Tax ID</Label>
                  <p className="text-sm text-muted-foreground">
                    Display tax ID on receipts
                  </p>
                </div>
                <Switch
                  checked={receiptSettings.showTaxId}
                  onCheckedChange={(checked) =>
                    setReceiptSettings({ ...receiptSettings, showTaxId: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Address</Label>
                  <p className="text-sm text-muted-foreground">
                    Display shop address on receipts
                  </p>
                </div>
                <Switch
                  checked={receiptSettings.showAddress}
                  onCheckedChange={(checked) =>
                    setReceiptSettings({ ...receiptSettings, showAddress: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Phone Number</Label>
                  <p className="text-sm text-muted-foreground">
                    Display phone number on receipts
                  </p>
                </div>
                <Switch
                  checked={receiptSettings.showPhone}
                  onCheckedChange={(checked) =>
                    setReceiptSettings({ ...receiptSettings, showPhone: checked })
                  }
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="paperSize">Paper Size</Label>
                <Select
                  value={receiptSettings.paperSize}
                  onValueChange={(value: '58mm' | '80mm' | 'A4') =>
                    setReceiptSettings({ ...receiptSettings, paperSize: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">58mm (Thermal — default)</SelectItem>
                    <SelectItem value="80mm">80mm (Thermal)</SelectItem>
                    <SelectItem value="A4">A4 (Standard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customMessage">Custom Message</Label>
                <Textarea
                  id="customMessage"
                  value={receiptSettings.customMessage}
                  onChange={(e) =>
                    setReceiptSettings({ ...receiptSettings, customMessage: e.target.value })
                  }
                  placeholder="Thank You For Shopping With Us!"
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  This message will appear at the bottom of receipts
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security & Privacy</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Change Password</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Update your password to keep your account secure
                </p>
                <Button variant="outline">
                  Change Password
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Add an extra layer of security to your account
                </p>
                <Button variant="outline">
                  Enable 2FA
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Active Sessions</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Manage devices where you're currently logged in
                </p>
                <Button variant="outline">
                  View Sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex justify-end gap-4">
        <Button variant="outline" onClick={fetchSettings}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
