import mongoose from 'mongoose'

const clusterSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true },
    baseUri:      { type: String, required: true }, // e.g. mongodb+srv://user:pass@cluster.xyz.mongodb.net
    maxTenants:   { type: Number, default: 5 },
    tenantCount:  { type: Number, default: 0 },
    isActive:     { type: Boolean, default: true },
    createdAt:    { type: Date, default: Date.now },
  },
  { collection: 'clusters' }
)

export default mongoose.models.Cluster || mongoose.model('Cluster', clusterSchema)
