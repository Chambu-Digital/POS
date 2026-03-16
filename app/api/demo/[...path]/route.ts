import { NextResponse } from 'next/server'

// Catch-all for any demo GET route not explicitly handled
// (e.g. /api/products/[id], /api/rentals/[id], etc.)
export async function GET() {
  return NextResponse.json({ data: null, _demo: true })
}
