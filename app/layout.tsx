import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import { PWADebug } from '@/components/pwa/pwa-debug'

import './globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Chambu POS',
  description: 'Point of Sale system with offline support — sales, inventory, KDS, bar & rentals',
  generator: 'Chambu Digital',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Chambu POS',
    startupImage: [],
  },
  icons: {
    icon: [
      { url: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/chambu-logo.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/chambu-logo.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
    shortcut: '/chambu-logo.svg',
  },
  other: {
    // Android Chrome
    'mobile-web-app-capable': 'yes',
    // iOS Safari
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Chambu POS',
    // MS Tiles
    'msapplication-TileColor': '#0f172a',
    'msapplication-TileImage': '/chambu-logo.svg',
    'msapplication-config': 'none',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#10b981' },
    { media: '(prefers-color-scheme: dark)',  color: '#0f172a' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* iOS splash / touch icon fallbacks */}
        <link rel="apple-touch-icon" href="/chambu-logo.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/chambu-logo.svg" />
        <link rel="mask-icon" href="/chambu-logo.svg" color="#10b981" />
      </head>
      <body className="font-sans antialiased">
        {children}
        <ServiceWorkerRegister />
        <PWADebug />
      </body>
    </html>
  )
}
