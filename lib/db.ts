import mongoose from 'mongoose'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: typeof mongoose | undefined
  // eslint-disable-next-line no-var
  var _mongooseConnPromise: Promise<typeof mongoose> | undefined
  // eslint-disable-next-line no-var
  var _adminConn: mongoose.Connection | undefined
  // eslint-disable-next-line no-var
  var _adminConnPromise: Promise<mongoose.Connection> | undefined
}

const CONN_OPTIONS: mongoose.ConnectOptions = {
  family: 4,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 3,   // Reduced from 5 to lower total connections
  minPoolSize: 1,
}

export async function connectDB() {
  // Return existing connection
  if (mongoose.connection.readyState === 1) {
    return
  }

  // Wait for in-flight connection
  if (global._mongooseConnPromise) {
    await global._mongooseConnPromise
    return
  }

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not defined')

  // Create and cache connection promise to prevent race conditions
  global._mongooseConnPromise = mongoose.connect(uri, CONN_OPTIONS)

  try {
    global._mongooseConn = await global._mongooseConnPromise
  } catch (error) {
    // Clear failed promise so retry is possible
    global._mongooseConnPromise = undefined
    throw error
  }
}

export async function connectAdminDB(): Promise<mongoose.Connection> {
  // Return existing connection
  if (global._adminConn?.readyState === 1) {
    return global._adminConn
  }

  // Wait for in-flight connection
  if (global._adminConnPromise) {
    return await global._adminConnPromise
  }

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not defined')

  // Create and cache connection promise to prevent race conditions
  global._adminConnPromise = mongoose.createConnection(uri, CONN_OPTIONS).asPromise()

  try {
    global._adminConn = await global._adminConnPromise
    return global._adminConn
  } catch (error) {
    // Clear failed promise so retry is possible
    global._adminConnPromise = undefined
    throw error
  }
}
