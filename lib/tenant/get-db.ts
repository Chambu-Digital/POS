// ─── Per-request DB helper ─────────────────────────────────────────────────────
// Resolves the tenant DB from the JWT token (mongoUri embedded at login).
// No subdomain header, no admin DB lookup on every request.

import { type NextRequest, NextResponse } from 'next/server'
import { connectTenantDB } from '@/lib/db-tenant'
import { connectDB } from '@/lib/db'
import mongoose from 'mongoose'
import { getModels } from './get-models'
import { normaliseFeatures, DEFAULT_MODULE_FEATURES } from '@/lib/modules'
import { getAuthPayload } from '@/lib/jwt'

// Mongoose readyState codes: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
function isConnectionHealthy(conn: mongoose.Connection): boolean {
  return conn.readyState === 1
}

// Returns true if the error is a MongoDB network/DNS failure (i.e. internet is down)
export function isMongoOfflineError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const name = (error as any).name || ''
  const msg = error.message || ''
  return (
    name === 'MongoServerSelectionError' ||
    name === 'MongoNetworkError' ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('getaddrinfo') ||
    msg.includes('connect EHOSTUNREACH')
  )
}

// Standard 503 response for when the DB is unreachable offline
export function dbOfflineResponse() {
  return NextResponse.json(
    { error: 'Database unavailable — server is offline', offline: true },
    { status: 503 }
  )
}

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
        throw error  // preserve original error type for isMongoOfflineError checks
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
