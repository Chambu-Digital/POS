// ─── Per-request DB helper ─────────────────────────────────────────────────────
// API routes call this instead of connectDB().
// Resolves tenant from x-tenant-subdomain header (set by middleware).
// Falls back to MONGODB_URI for localhost / no subdomain.

import { type NextRequest } from 'next/server'
import { connectTenantDB } from '@/lib/db-tenant'
import { connectDB } from '@/lib/db'
import { resolveTenant } from './resolve'
import mongoose from 'mongoose'
import { getModels } from './get-models'

// Cache resolved tenants in memory to avoid a DB lookup on every request
const tenantCache = new Map<string, { mongoUri: string; features: Record<string, boolean>; cachedAt: number }>()
const CACHE_TTL = 60_000 // 1 minute

export async function getTenantDB(request: NextRequest) {
  const subdomain = request.headers.get('x-tenant-subdomain')

  if (subdomain) {
    // Check memory cache first
    const cached = tenantCache.get(subdomain)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      const conn = await connectTenantDB(cached.mongoUri)
      return { conn, models: getModels(conn), features: cached.features }
    }

    // Resolve from admin DB
    const tenant = await resolveTenant(subdomain)
    if (tenant) {
      tenantCache.set(subdomain, { mongoUri: tenant.mongoUri, features: tenant.features, cachedAt: Date.now() })
      const conn = await connectTenantDB(tenant.mongoUri)
      return { conn, models: getModels(conn), features: tenant.features }
    }
  }

  // Localhost / no tenant — use the default MONGODB_URI
  await connectDB()
  const conn = mongoose.connection
  return { conn, models: getModels(conn), features: {} }
}
