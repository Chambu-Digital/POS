import mongoose from 'mongoose'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

// Cache tenant connections on the global object so they survive hot reloads
// in dev and are reused across requests in the same Vercel function instance.
declare global {
  // eslint-disable-next-line no-var
  var _tenantConnections: Map<string, mongoose.Connection> | undefined
}

function getPool(): Map<string, mongoose.Connection> {
  if (!global._tenantConnections) {
    global._tenantConnections = new Map()
  }
  return global._tenantConnections
}

export async function connectTenantDB(uri: string): Promise<mongoose.Connection> {
  const pool = getPool()

  const existing = pool.get(uri)
  if (existing && existing.readyState === 1) {
    return existing
  }

  // Remove stale entry if connection dropped
  if (existing) pool.delete(uri)

  const conn = await mongoose
    .createConnection(uri, {
      family: 4,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .asPromise()

  pool.set(uri, conn)
  return conn
}
