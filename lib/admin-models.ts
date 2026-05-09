import mongoose from 'mongoose'
import { connectAdminDB } from './db'
import { DEFAULT_FEATURES } from './features'

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

export async function getAdminModels() {
  const conn = await connectAdminDB()
  const Tenant  = conn.models.Tenant  || conn.model('Tenant',  tenantSchema)
  const Cluster = conn.models.Cluster || conn.model('Cluster', clusterSchema)
  return { Tenant, Cluster }
}
