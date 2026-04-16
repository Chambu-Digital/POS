import mongoose from 'mongoose'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

// Cache connection on the global object so it survives hot reloads in dev
// and is reused across requests within the same Vercel function instance.
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: typeof mongoose | undefined
}

export async function connectDB() {
  if (global._mongooseConn && mongoose.connection.readyState === 1) {
    return
  }

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not defined')

  await mongoose.connect(uri, {
    family: 4,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })

  global._mongooseConn = mongoose
}
