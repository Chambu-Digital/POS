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
    paymentNotification: {
      enabled: { type: Boolean, default: false },
      paymentUrl: { type: String, default: '' },
      message: { type: String, default: '' },
      daysOverdue: { type: Number, default: 0 },
    },
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

// Email-to-Tenant mapping for fast login lookups
const userEmailIndexSchema = new mongoose.Schema(
  {
    email:      { type: String, required: true, lowercase: true, trim: true },
    tenantId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    userType:   { type: String, enum: ['user', 'staff'], required: true },
    userId:     { type: String, required: true }, // ID in the tenant DB
    isActive:   { type: Boolean, default: true },
    lastSync:   { type: Date, default: Date.now },
  },
  { 
    collection: 'user_email_index',
    timestamps: true 
  }
)

// Compound index for fast email lookups
userEmailIndexSchema.index({ email: 1, isActive: 1 })
userEmailIndexSchema.index({ tenantId: 1 })

export async function getAdminModels() {
  const conn = await connectAdminDB()
  const Tenant  = conn.models.Tenant  || conn.model('Tenant',  tenantSchema)
  const Cluster = conn.models.Cluster || conn.model('Cluster', clusterSchema)
  const UserEmailIndex = conn.models.UserEmailIndex || conn.model('UserEmailIndex', userEmailIndexSchema)
  return { Tenant, Cluster, UserEmailIndex }
}
