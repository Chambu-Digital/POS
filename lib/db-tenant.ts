import mongoose from 'mongoose'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

declare global {
  // eslint-disable-next-line no-var
  var _tenantConnections: Map<string, mongoose.Connection> | undefined
}

function getPool(): Map<string, mongoose.Connection> {
  if (!global._tenantConnections) global._tenantConnections = new Map()
  return global._tenantConnections
}

// Max tenant connections cached per instance — prevents runaway connection growth
const MAX_CACHED_TENANTS = 10

export async function connectTenantDB(uri: string): Promise<mongoose.Connection> {
  const pool = getPool()

  const existing = pool.get(uri)
  if (existing?.readyState === 1) return existing

  // Remove stale entry
  if (existing) pool.delete(uri)

  // Evict oldest entry if pool is full to avoid connection leak
  if (pool.size >= MAX_CACHED_TENANTS) {
    const oldest = pool.keys().next().value
    if (oldest) {
      try { await pool.get(oldest)?.close() } catch {}
      pool.delete(oldest)
    }
  }

  const conn = await mongoose.createConnection(uri, {
    family: 4,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 3,  // small pool per tenant
    minPoolSize: 1,
  }).asPromise()

  pool.set(uri, conn)
  return conn
}
