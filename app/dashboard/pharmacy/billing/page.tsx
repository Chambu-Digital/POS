'use client'

import { Receipt } from 'lucide-react'

export default function HmsBillingPage() {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
        <Receipt size={32} className="text-blue-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">HMS Billing</h1>
      <p className="text-gray-500 max-w-sm">Patient billing and payment management. Coming soon.</p>
    </div>
  )
}
