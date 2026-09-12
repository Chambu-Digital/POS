'use client'

import type { Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import { PWADebug } from '@/components/pwa/pwa-debug'
import { Toaster } from 'sonner'

import './globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#10b981" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Chambu POS" />
        <meta name="msapplication-TileColor" content="#0f172a" />
        <meta name="msapplication-TileImage" content="/chambu-logo.svg" />
        <meta name="msapplication-config" content="none" />
        <meta name="generator" content="Chambu Digital" />
        <title>Chambu POS</title>
        <meta name="description" content="Point of Sale system with offline support — sales, inventory, KDS, bar & rentals" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-192.svg" sizes="192x192" type="image/svg+xml" />
        <link rel="icon" href="/chambu-logo.svg" sizes="512x512" type="image/svg+xml" />
        <link rel="shortcut icon" href="/chambu-logo.svg" />
        {/* iOS splash / touch icon fallbacks */}
        <link rel="apple-touch-icon" href="/chambu-logo.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/chambu-logo.svg" />
        <link rel="mask-icon" href="/chambu-logo.svg" color="#10b981" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        <Toaster position="top-center" richColors />
        <ServiceWorkerRegister />
        <PWADebug />
      </body>
    </html>
  )
}
