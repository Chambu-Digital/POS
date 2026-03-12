import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('[M-Pesa] Callback received:', JSON.stringify(body, null, 2))

    // Extract callback data
    const { Body } = body
    const { stkCallback } = Body

    if (stkCallback) {
      const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback

      if (ResultCode === 0) {
        // Payment successful
        console.log('[M-Pesa] Payment successful:', {
          MerchantRequestID,
          CheckoutRequestID,
          ResultDesc,
        })

        // Extract metadata
        if (CallbackMetadata && CallbackMetadata.Item) {
          const metadata: any = {}
          CallbackMetadata.Item.forEach((item: any) => {
            metadata[item.Name] = item.Value
          })

          console.log('[M-Pesa] Payment metadata:', metadata)
          // metadata contains: Amount, MpesaReceiptNumber, TransactionDate, PhoneNumber
          
          // TODO: Update order status in database with metadata.MpesaReceiptNumber
        }
      } else {
        // Payment failed or cancelled
        console.log('[M-Pesa] Payment failed:', {
          MerchantRequestID,
          CheckoutRequestID,
          ResultCode,
          ResultDesc,
        })
      }
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Success' })
  } catch (error) {
    console.error('[M-Pesa] Callback error:', error)
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: 'Failed' },
      { status: 500 }
    )
  }
}
