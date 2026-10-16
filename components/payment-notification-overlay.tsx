'use client'

import { ExternalLink } from 'lucide-react'

interface PaymentNotificationOverlayProps {
  paymentUrl: string
  message?: string
  daysOverdue?: number
}

export default function PaymentNotificationOverlay({
  paymentUrl,
  message,
  daysOverdue = 0,
}: PaymentNotificationOverlayProps) {
  const defaultMessage = `Your subscription payment is **${daysOverdue} days overdue**. Please settle your outstanding balance to restore or maintain uninterrupted access to the system.

Kindly make your payment as soon as possible.

**Please contact support if you have already made the payment.**`

  const displayMessage = message || defaultMessage

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
      <div className="max-w-lg w-full mx-4 bg-white rounded-lg shadow-2xl border border-gray-200 border-l-4 border-l-red-600">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Payment Overdue</h1>
          <p className="text-sm text-gray-500 mt-1">Action required to continue</p>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-5">
          
          {/* Days overdue - subtle red */}
          {daysOverdue > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
              <p className="text-sm text-red-800">
                Payment is <span className="font-semibold">{daysOverdue} {daysOverdue === 1 ? 'day' : 'days'}</span> overdue
              </p>
            </div>
          )}

          {/* Message */}
          <div className="text-sm text-gray-600 leading-relaxed space-y-3">
            {displayMessage.split('\n\n').map((paragraph, i) => (
              <p key={i}>
                {paragraph.split('**').map((part, j) =>
                  j % 2 === 0 ? (
                    part
                  ) : (
                    <span key={j} className="font-medium text-gray-900">
                      {part}
                    </span>
                  )
                )}
              </p>
            ))}
          </div>

          {/* Payment button */}
          <div className="pt-2">
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-3 rounded-md transition-colors duration-150"
            >
              <span>Make Payment</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* Support contact */}
          <div className="text-center pt-1">
            <p className="text-xs text-gray-500">
              Already paid?{' '}
              <a
                href="mailto:support@example.com"
                className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
              >
                Contact Support
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <p className="text-xs text-gray-500 text-center">
            Access is restricted until payment is verified
          </p>
        </div>
      </div>
    </div>
  )
}
