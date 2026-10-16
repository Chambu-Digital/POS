import { NextResponse } from 'next/server'
import { getConnectionDiagnostics } from '@/lib/db-diagnostics'
import { getTenantConnectionStats } from '@/lib/db-tenant'

export async function GET() {
  try {
    const connectionInfo = getConnectionDiagnostics()
    const tenantStats = getTenantConnectionStats()

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      instanceId: process.env.VERCEL_REGION || 'local',
      connections: connectionInfo,
      tenantCache: tenantStats,
      recommendation: connectionInfo.totalEstimatedConnections > 25 
        ? 'High connection count detected. Monitor Atlas metrics.'
        : 'Connection count looks healthy.',
    })
  } catch (error) {
    console.error('[connection-diagnostics] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get connection diagnostics',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}
