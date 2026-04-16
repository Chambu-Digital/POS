// ─── Tenant resolver ───────────────────────────────────────────────────────────
// Looks up a tenant by subdomain in the admin DB.
// Called from getTenantDB (Node.js runtime only — not Edge-safe).

import { connectDB } from '@/lib/db'
import Tenant from '@/lib/models/Tenant'

export async function resolveTenant(subdomain: string) {
  await connectDB() // admin DB — always uses MONGODB_URI from .env
  return Tenant.findOne({ subdomain, isActive: true }).lean() as Promise<{
    _id: string
    subdomain: string
    mongoUri: string
    features: Record<string, boolean>
    shopName: string
  } | null>
}
