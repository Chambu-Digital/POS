# SaaS Multi-Tenant Migration Plan (Simplified)

## The Idea in One Sentence
Instead of reading the MongoDB URI from `.env`, read it from your admin DB based on the subdomain of the incoming request. Everything else stays the same.

---

## How It Works

```
client1.yourapp.com
  → middleware reads subdomain → "client1"
  → queries admin DB → { mongoUri: "mongodb+srv://...client1", features: {...} }
  → connects to client1's DB
  → all existing dashboard/API logic runs unchanged
```

Your current DB becomes the **admin DB** (tenant registry). Each client gets their own MongoDB database that you manually create and register.

---

## What Changes vs What Stays the Same

### Changes (minimal)
- `middleware.ts` — resolve subdomain, fetch tenant config, attach to request
- `lib/db.ts` — accept a URI parameter instead of always reading from `.env`
- `/admin` — new section for managing tenants (separate from `/dashboard`)

### Stays exactly the same
- Every page under `/dashboard`
- All API route logic and queries
- Auth / JWT
- Feature flags in sidebar (just change the data source)
- IndexedDB / offline logic
- Everything else

---

## Data Model (Admin DB)

One collection in your existing DB: `tenants`

```js
{
  subdomain: "client1",           // client1.yourapp.com
  mongoUri: "mongodb+srv://...",  // their DB — you create this manually
  isActive: true,
  features: {
    pos: true,
    kitchenDisplay: false,
    bar: false,
    rentals: true,
    reports: true,
  },
  shopName: "Client One Shop",    // display only
  createdAt: Date,
}
```

---

## Implementation Steps

### Step 1 — Tenant Model
Create `lib/models/Tenant.ts` in your existing codebase.
Fields: `subdomain`, `mongoUri`, `isActive`, `features`, `shopName`, `createdAt`.
This model uses your current DB connection (the admin DB).

### Step 2 — Connection Pool
Create `lib/db-tenant.ts` — a connection cache keyed by URI.

```ts
const pool = new Map<string, mongoose.Connection>()

export async function connectTenantDB(uri: string): Promise<mongoose.Connection> {
  if (pool.has(uri)) return pool.get(uri)!
  const conn = await mongoose.createConnection(uri).asPromise()
  pool.set(uri, conn)
  return conn
}
```

This is the only real engineering piece. The pool lives in server memory so connections are reused across requests.

> **Note on Vercel:** Serverless functions are stateless — the pool resets on cold starts. This means occasional reconnects but it still works. For best performance, use a persistent server (Railway, Render, VPS). Decision to make before going to production.

### Step 3 — Tenant Resolver
Create `lib/tenant/resolve.ts`.

```ts
export async function resolveTenant(hostname: string) {
  const subdomain = hostname.split('.')[0]
  // Skip admin and www
  if (['admin', 'www', 'localhost'].includes(subdomain)) return null
  await connectDB() // admin DB
  return Tenant.findOne({ subdomain, isActive: true }).lean()
}
```

### Step 4 — Middleware Update
Update `middleware.ts` to resolve tenant and attach URI + features to request headers.

```ts
const tenant = await resolveTenant(request.nextUrl.hostname)
if (!tenant) return NextResponse.next() // localhost / admin — skip

const res = NextResponse.next()
res.headers.set('x-tenant-uri',      tenant.mongoUri)
res.headers.set('x-tenant-features', JSON.stringify(tenant.features))
return res
```

### Step 5 — Update API Routes
Each API route currently does:
```ts
await connectDB()
const products = await Product.find({ userId: ownerId })
```

After update:
```ts
const uri = request.headers.get('x-tenant-uri') || process.env.MONGODB_URI!
const conn = await connectTenantDB(uri)
const Product = conn.model('Product', productSchema)
const products = await Product.find({ userId: ownerId })
```

To avoid touching every route individually, create a helper:
```ts
// lib/tenant/get-db.ts
export async function getTenantDB(request: NextRequest) {
  const uri = request.headers.get('x-tenant-uri') || process.env.MONGODB_URI!
  return connectTenantDB(uri)
}
```

Then each route just calls `getTenantDB(request)` instead of `connectDB()`.

Create `lib/models/index.ts` — model factory per connection:
```ts
export function getModels(conn: mongoose.Connection) {
  return {
    Product:  conn.models.Product  || conn.model('Product',  productSchema),
    Sale:     conn.models.Sale     || conn.model('Sale',     saleSchema),
    User:     conn.models.User     || conn.model('User',     userSchema),
    Category: conn.models.Category || conn.model('Category', categorySchema),
    Staff:    conn.models.Staff    || conn.model('Staff',    staffSchema),
  }
}
```

The `conn.models.X || conn.model(...)` pattern prevents "model already registered" errors.

### Step 6 — Feature Flags
The sidebar already fetches `/api/settings` for `kdsEnabled` / `barEnabled`.
Add a new endpoint `GET /api/tenant/config` that returns the tenant's feature flags from the header (no DB query needed — already in the header from middleware).

```ts
export async function GET(request: NextRequest) {
  const features = JSON.parse(request.headers.get('x-tenant-features') || '{}')
  return NextResponse.json({ features })
}
```

Sidebar fetches this instead of parsing settings for feature flags.

### Step 7 — Admin Panel `/admin`
A separate section of the app, protected by `ADMIN_SECRET_CODE`.
Uses your existing DB (admin DB) directly — no tenant switching needed here.

**Pages:**
```
/admin                  → dashboard (tenant count, active count)
/admin/tenants          → list all tenants
/admin/tenants/new      → create tenant (subdomain + mongoUri + features)
/admin/tenants/[id]     → edit tenant (toggle features, activate/deactivate)
```

**Auth:** Simple — a separate login page that checks `ADMIN_SECRET_CODE` and issues a short-lived admin session cookie. Completely separate from the client JWT auth.

---

## Localhost / Development Behaviour
When running locally, `hostname` is `localhost` — the resolver returns `null` and the app falls back to `process.env.MONGODB_URI` exactly as today. Zero changes to local dev workflow.

---

## Onboarding a New Client (Your Workflow)
1. Create their MongoDB database (Atlas, wherever)
2. Go to `/admin/tenants/new`
3. Enter: subdomain, MongoDB URI, feature toggles
4. Point their subdomain DNS to your server
5. Done — they're live

---

## Environment Variables
No new required vars. One optional addition:
```env
# Existing — becomes the fallback for localhost + the admin DB
MONGODB_URI=mongodb+srv://...your-current-db

# Optional: separate admin DB if you want to isolate it later
# MONGODB_ADMIN_URI=mongodb+srv://...admin-db
```

---

## Migration of Current Clients
Your current DB is already the first "tenant". To migrate:
1. Add a tenant record: `{ subdomain: "yourclient", mongoUri: process.env.MONGODB_URI, ... }`
2. Point their subdomain to the app
3. Test — they see exactly what they see today
4. Done

---

## What This Is NOT
- Not a complex provisioning system
- Not Kubernetes or microservices
- Not a rewrite
- Not touching the dashboard at all

It's a thin routing layer on top of what already works.
