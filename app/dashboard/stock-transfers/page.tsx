'use client'

import { useState, useEffect } from 'react'
import { Package, Clock, CheckCircle, XCircle, ArrowRight, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReceiveTransferModal } from '@/components/stock-transfers/receive-transfer-modal'
import { TransferDetailsModal } from '@/components/stock-transfers/transfer-details-modal'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface StockTransfer {
  _id: string
  transferNumber: string
  fromBranchId: { _id: string; name: string; code: string }
  toBranchId: { _id: string; name: string; code: string }
  items: Array<{
    productId?: string
    drugId?: string
    itemName: string
    quantitySent: number
    quantityReceived: number | null
    unitPrice: number
  }>
  status: 'pending_receipt' | 'received' | 'rejected'
  createdBy: { name: string; email: string } | null
  receivedBy: { name: string; email: string } | null
  rejectedBy: { name: string; email: string } | null
  notes: string
  rejectionReason: string
  createdAt: string
  receivedAt: string | null
  rejectedAt: string | null
}

export default function StockTransfersPage() {
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null)
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [permissions, setPermissions] = useState({ create: false, receive: false })

  useEffect(() => {
    fetchPermissions()
    fetchTransfers()
  }, [activeTab])

  async function fetchPermissions() {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        const userPermissions = data.user?.permissions || {}
        setPermissions({
          create: userPermissions['stock-transfers.create'] === true || data.user?.type === 'user',
          receive: userPermissions['stock-transfers.receive'] === true || data.user?.type === 'user',
        })
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error)
    }
  }

  async function fetchTransfers() {
    try {
      let url = '/api/stock-transfers'
      const params = new URLSearchParams()

      if (activeTab === 'sent') params.append('direction', 'sent')
      if (activeTab === 'received') params.append('direction', 'received')
      if (activeTab === 'pending') params.append('status', 'pending_receipt')

      if (params.toString()) url += `?${params.toString()}`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setTransfers(data.transfers || [])
      }
    } catch (error) {
      console.error('Failed to fetch transfers:', error)
      toast.error('Failed to load transfers')
    } finally {
      setLoading(false)
    }
  }

  function handleTransferReceived() {
    setIsReceiveModalOpen(false)
    fetchTransfers()
    toast.success('Transfer received successfully')
  }

  function openReceiveModal(transfer: StockTransfer) {
    setSelectedTransfer(transfer)
    setIsReceiveModalOpen(true)
  }

  function openDetailsModal(transfer: StockTransfer) {
    setSelectedTransfer(transfer)
    setIsDetailsModalOpen(true)
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending_receipt':
        return <Badge variant="outline" className="bg-yellow-50"><Clock size={12} className="mr-1" /> Pending</Badge>
      case 'received':
        return <Badge variant="outline" className="bg-green-50"><CheckCircle size={12} className="mr-1" /> Received</Badge>
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50"><XCircle size={12} className="mr-1" /> Rejected</Badge>
      default:
        return null
    }
  }

  const pendingCount = transfers.filter(t => t.status === 'pending_receipt').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Transfers</h1>
          <p className="text-muted-foreground mt-2">View inter-branch stock movements. Create transfers from inventory pages.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Receipt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transfers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transfers.filter(t => t.status === 'received').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transfers List */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
          <CardDescription>View and manage stock transfers between branches</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
              <TabsTrigger value="received">Received</TabsTrigger>
              <TabsTrigger value="pending">
                Pending {pendingCount > 0 && `(${pendingCount})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : transfers.length === 0 ? (
                <div className="text-center py-12">
                  <Package size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
                  <p className="text-muted-foreground">No transfers found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transfers.map(transfer => (
                    <div
                      key={transfer._id}
                      className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{transfer.transferNumber}</h3>
                            {getStatusBadge(transfer.status)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{transfer.fromBranchId.name}</span>
                            <ArrowRight size={14} />
                            <span>{transfer.toBranchId.name}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(transfer.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {transfer.items.length} item{transfer.items.length !== 1 ? 's' : ''}
                          {transfer.createdBy && ` • Created by ${transfer.createdBy.name}`}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDetailsModal(transfer)}
                          >
                            View Details
                          </Button>
                          {transfer.status === 'pending_receipt' && permissions.receive && (
                            <Button
                              size="sm"
                              onClick={() => openReceiveModal(transfer)}
                            >
                              Receive
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modals */}
      {isReceiveModalOpen && selectedTransfer && (
        <ReceiveTransferModal
          isOpen={isReceiveModalOpen}
          transfer={selectedTransfer}
          onClose={() => {
            setIsReceiveModalOpen(false)
            setSelectedTransfer(null)
          }}
          onSuccess={handleTransferReceived}
        />
      )}

      {isDetailsModalOpen && selectedTransfer && (
        <TransferDetailsModal
          isOpen={isDetailsModalOpen}
          transfer={selectedTransfer}
          onClose={() => {
            setIsDetailsModalOpen(false)
            setSelectedTransfer(null)
          }}
          onRefresh={fetchTransfers}
        />
      )}
    </div>
  )
}
