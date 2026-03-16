import { NextResponse } from 'next/server'
import { getDemoProducts } from '@/lib/demo'

export async function GET() {
  return NextResponse.json({ products: getDemoProducts() })
}
