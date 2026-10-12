// ─── Per-request DB helper ─────────────────────────────────────────────────────
// Resolves the tenant DB from the JWT token (mongoUri embedded at login).
// No subdomain header, no admin DB lookup on every request.

import { type NextRequest } from 'next/server'
import { connectTenantDB } from '@/lib/db-tenant'
import { connectDB } from '@/lib/db'
import mongoose from 'mongoose'
import { getModels } from './get-models'
import { normaliseFeatures, DEFAULT_MODULE_FEATURES } from '@/lib/modules'
import { getAuthPayload } from '@/lib/jwt'

export async function getTenantDB(_request?: NextRequest) {
  try {
    const payload = await getAuthPayload()

    // Authenticated request with a tenant URI in the token
    if (payload?.mongoUri) {
      try {
        const features = normaliseFeatures(payload.tenantFeatures || {})
        const conn = await connectTenantDB(payload.mongoUri)
        return { conn, models: getModels(conn), features }
      } catch (error) {
        console.error('[getTenantDB] Failed to connect to tenant URI:', error)
        throw new Error(`Failed to connect to tenant database: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Localhost dev / no token — fall back to default MONGODB_URI
    await connectDB()
    const conn = mongoose.connection
    return { conn, models: getModels(conn), features: DEFAULT_MODULE_FEATURES }
  } catch (error) {
    console.error('[getTenantDB] Error:', error)
    throw error
  }
}
