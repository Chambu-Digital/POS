import mongoose from 'mongoose'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: typeof mongoose | undefined
  // eslint-disable-next-line no-var
  var _adminConn: mongoose.Connection | undefined
}

const CONN_OPTIONS: mongoose.ConnectOptions = {
  family: 4,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 5,   // limit connections per instance
  minPoolSize: 1,
}

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return
  if (mongoose.connection.readyState === 2) {
    await new Promise(resolve => mongoose.connection.once('connected', resolve))
    return
  }

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not defined')

  await mongoose.connect(uri, CONN_OPTIONS)
  global._mongooseConn = mongoose
}

export async function connectAdminDB(): Promise<mongoose.Connection> {
  if (global._adminConn?.readyState === 1) return global._adminConn

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not defined')

  const conn = await mongoose.createConnection(uri, CONN_OPTIONS).asPromise()
  global._adminConn = conn
  return conn
}
