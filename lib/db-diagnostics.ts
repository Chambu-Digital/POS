import mongoose from 'mongoose'

interface ConnectionInfo {
  name: string
  readyState: string
  poolSize?: number
  host?: string
}

export function getConnectionDiagnostics(): {
  mainConnection: ConnectionInfo
  adminConnection: ConnectionInfo | null
  tenantConnections: Array<{ uri: string; readyState: string; poolSize?: number }>
  totalEstimatedConnections: number
} {
  const pool = global._tenantConnections || new Map()
  
  const mainConn: ConnectionInfo = {
    name: 'main',
    readyState: getReadyStateLabel(mongoose.connection.readyState),
    poolSize: mongoose.connection.readyState === 1 ? 3 : 0,
    host: mongoose.connection.host,
  }

  const adminConn: ConnectionInfo | null = global._adminConn ? {
    name: 'admin',
    readyState: getReadyStateLabel(global._adminConn.readyState),
    poolSize: global._adminConn.readyState === 1 ? 3 : 0,
    host: global._adminConn.host,
  } : null

  const tenantConns = Array.from(pool.entries()).map(([uri, conn]) => ({
    uri: uri.substring(0, 60) + '...',
    readyState: getReadyStateLabel(conn.readyState),
    poolSize: conn.readyState === 1 ? 2 : 0,
  }))

  const totalEstimated = 
    (mainConn.poolSize || 0) + 
    (adminConn?.poolSize || 0) + 
    tenantConns.reduce((sum, conn) => sum + (conn.poolSize || 0), 0)

  return {
    mainConnection: mainConn,
    adminConnection: adminConn,
    tenantConnections: tenantConns,
    totalEstimatedConnections: totalEstimated,
  }
}

function getReadyStateLabel(state: number): string {
  switch (state) {
    case 0: return 'disconnected'
    case 1: return 'connected'
    case 2: return 'connecting'
    case 3: return 'disconnecting'
    default: return 'unknown'
  }
}
