import mongoose from 'mongoose'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

declare global {
  // eslint-disable-next-line no-var
  var _tenantConnections: Map<string, mongoose.Connection> | undefined
  // eslint-disable-next-line no-var
  var _tenantConnectionStats: Map<string, { hits: number; misses: number; lastUsed: number }> | undefined
}

function getPool(): Map<string, mongoose.Connection> {
  if (!global._tenantConnections) global._tenantConnections = new Map()
  return global._tenantConnections
}

function getStats(): Map<string, { hits: number; misses: number; lastUsed: number }> {
  if (!global._tenantConnectionStats) global._tenantConnectionStats = new Map()
  return global._tenantConnectionStats
}

// Max tenant connections cached per instance — prevents runaway connection growth
const MAX_CACHED_TENANTS = 10

export async function connectTenantDB(uri: string): Promise<mongoose.Connection> {
  const startTime = Date.now()
  const pool = getPool()
  const stats = getStats()

  const existing = pool.get(uri)
  if (existing?.readyState === 1) {
    // Cache hit
    const stat = stats.get(uri) || { hits: 0, misses: 0, lastUsed: 0 }
    stat.hits++
    stat.lastUsed = Date.now()
    stats.set(uri, stat)
    
    const duration = Date.now() - startTime
    console.log(`[db-tenant] ✓ Cache HIT for ${uri.substring(0, 50)}... (${duration}ms)`)
    return existing
  }

  // Cache miss
  const stat = stats.get(uri) || { hits: 0, misses: 0, lastUsed: 0 }
  stat.misses++
  stat.lastUsed = Date.now()
  stats.set(uri, stat)

  // Remove stale entry
  if (existing) {
    console.log(`[db-tenant] Removing stale connection for ${uri.substring(0, 50)}...`)
    pool.delete(uri)
  }

  // Evict oldest entry if pool is full to avoid connection leak
  if (pool.size >= MAX_CACHED_TENANTS) {
    const oldest = pool.keys().next().value
    if (oldest) {
      console.log(`[db-tenant] ⚠️  Pool full (${pool.size}/${MAX_CACHED_TENANTS}), evicting: ${oldest.substring(0, 50)}...`)
      try { await pool.get(oldest)?.close() } catch {}
      pool.delete(oldest)
    }
  }

  console.log(`[db-tenant] ✗ Cache MISS, establishing new connection to ${uri.substring(0, 50)}...`)
  const connStartTime = Date.now()
  
  const conn = await mongoose.createConnection(uri, {
    family: 4,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 3,  // small pool per tenant
    minPoolSize: 1,
  }).asPromise()

  const connDuration = Date.now() - connStartTime
  const totalDuration = Date.now() - startTime
  console.log(`[db-tenant] ✓ Connection established in ${connDuration}ms (total: ${totalDuration}ms)`)

  pool.set(uri, conn)
  return conn
}

export function getTenantConnectionStats() {
  const stats = getStats()
  const pool = getPool()
  
  return {
    maxCachedTenants: MAX_CACHED_TENANTS,
    currentCached: pool.size,
    connections: Array.from(stats.entries()).map(([uri, stat]) => ({
      uri: uri.substring(0, 60) + '...',
      hits: stat.hits,
      misses: stat.misses,
      lastUsed: new Date(stat.lastUsed).toISOString(),
      hitRate: stat.hits + stat.misses > 0 ? (stat.hits / (stat.hits + stat.misses) * 100).toFixed(1) + '%' : 'N/A'
    }))
  }
}
