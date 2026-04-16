import mongoose from 'mongoose'
import { DEFAULT_FEATURES } from '@/lib/features'

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

export default mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema)
