// ─── /dashboard/retail/sales ─────────────────────────────────────────────────
// Canonical Retail → Make Sale route.
// Re-exports the implementation that lives at the legacy path.
// API calls, sessionStorage keys, and router.push('/dashboard/sales/payment')
// inside the implementation remain unchanged.
export { default } from '@/app/dashboard/sales/page'
