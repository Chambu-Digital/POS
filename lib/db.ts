import mongoose from 'mongoose'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

// Cache connection on the global object so it survives hot reloads in dev
// and is reused across requests within the same Vercel function instance.
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: typeof mongoose | undefined
  // eslint-disable-next-line no-var
  var _adminMongooseConn: typeof mongoose | undefined
}

export async function connectDB() {
  // If already connected, reuse
  if (mongoose.connection.readyState === 1) {
    console.log('[connectDB] Using existing connection')
    return
  }

  // If connecting, wait for it
  if (mongoose.connection.readyState === 2) {
    console.log('[connectDB] Connection in progress, waiting...')
    await new Promise((resolve) => {
      mongoose.connection.once('connected', resolve)
    })
    return
  }

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not defined')

  console.log('[connectDB] Creating new connection, current state:', mongoose.connection.readyState)

  try {
    await mongoose.connect(uri, {
      family: 4,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    global._mongooseConn = mongoose
    console.log('[connectDB] Connected successfully')
  } catch (error) {
    console.error('[connectDB] Connection failed:', error)
    throw error
  }
}

// Admin database connection for multi-tenant management
export async function connectAdminDB() {
  // Check if we already have a valid connection
  if (global._adminMongooseConn) {
    const conn = global._adminMongooseConn as any
    if (conn.readyState === 1) {
      return conn
    }
  }

  const uri = process.env.ADMIN_MONGODB_URI
  if (!uri) {
    throw new Error('ADMIN_MONGODB_URI is not defined in environment variables')
  }

  try {
    // Create a separate connection for admin database
    const adminConn = mongoose.createConnection(uri, {
      family: 4,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    // Wait for connection to be ready
    await adminConn.asPromise()

    global._adminMongooseConn = adminConn as any
    console.log('[connectAdminDB] Connected to admin database')

    return adminConn
  } catch (error) {
    console.error('[connectAdminDB] Failed to connect:', error)
    throw error
  }
}
