import mongoose from 'mongoose'
import { DEFAULT_FEATURES } from './features'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

// Cache admin connection
declare global {
  // eslint-disable-next-line no-var
  var _adminConnection: mongoose.Connection | undefined
}

// Tenant schema
const tenantSchema = new mongoose.Schema(
  {
    subdomain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mongoUri:  { type: String, required: true },
    shopName:  { type: String, default: '' },
    isActive:  { type: Boolean, default: true },
    features:  { type: mongoose.Schema.Types.Mixed, default: () => ({ ...DEFAULT_FEATURES }) },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'tenants' }
)

// Cluster schema
const clusterSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true },
    baseUri:      { type: String, required: true },
    maxTenants:   { type: Number, default: 5 },
    tenantCount:  { type: Number, default: 0 },
    isActive:     { type: Boolean, default: true },
    createdAt:    { type: Date, default: Date.now },
  },
  { collection: 'clusters' }
)

// Connect to admin database (uses MONGODB_URI for now)
async function connectAdminDB(): Promise<mongoose.Connection> {
  if (global._adminConnection && global._adminConnection.readyState === 1) {
    return global._adminConnection
  }

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not defined')

  console.log('[connectAdminDB] Creating connection...')

  const conn = await mongoose.createConnection(uri, {
    family: 4,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }).asPromise()

  global._adminConnection = conn
  console.log('[connectAdminDB] Connected successfully')
  
  return conn
}

// Get admin models with their own connection
export async function getAdminModels() {
  const conn = await connectAdminDB()
  
  const Tenant = conn.models.Tenant || conn.model('Tenant', tenantSchema)
  const Cluster = conn.models.Cluster || conn.model('Cluster', clusterSchema)
  
  return { Tenant, Cluster }
}
