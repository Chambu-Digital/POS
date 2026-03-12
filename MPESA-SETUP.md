# M-Pesa Integration Setup Guide

## Prerequisites
1. M-Pesa Daraja API account (https://developer.safaricom.co.ke/)
2. Consumer Key and Consumer Secret
3. Shortcode (Paybill or Till Number)
4. Passkey

## Environment Variables

Add these to your `.env.local` file:

```env
# M-Pesa Daraja API Credentials
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey_here
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback

# For production, use:
# https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
# https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest

# For sandbox/testing, use:
# https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
# https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
```

## Getting Started

### 1. Create Daraja Account
- Go to https://developer.safaricom.co.ke/
- Sign up for an account
- Create a new app

### 2. Get Credentials
- Consumer Key: Found in your app dashboard
- Consumer Secret: Found in your app dashboard
- Shortcode: Your business paybill/till number
- Passkey: Provided by Safaricom for your shortcode

### 3. Test with Sandbox
- Use sandbox credentials for testing
- Test phone number: 254708374149
- Test amount: Any amount

### 4. Features Implemented

#### STK Push
- Customer receives payment prompt on their phone
- Enter M-Pesa PIN to complete payment
- Automatic payment verification

#### Manual Entry (Fallback)
- Customer pays via Paybill/Till
- Manually enter transaction code
- Useful when STK Push fails

## Usage Flow

1. Customer selects M-Pesa payment method
2. Enters phone number
3. Two options:
   - **STK Push**: Click "Send STK Push" → Customer enters PIN on phone
   - **Manual**: Pay via Paybill 522522, A/C: 7716828 → Enter transaction code

## Production Deployment

1. Update callback URL to your production domain
2. Switch from sandbox to production URLs in `lib/mpesa.ts`
3. Use production credentials
4. Test thoroughly before going live

## Support
For M-Pesa integration support, contact Safaricom Daraja support.
