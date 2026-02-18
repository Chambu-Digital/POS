import mongoose from 'mongoose'
import dns from 'dns'

// Force IPv4 DNS resolution to fix MongoDB Atlas connection issues
dns.setDefaultResultOrder('ipv4first')

let isConnected = false

export async function connectDB() {
  if (isConnected) {
    return
  }

  const mongoUrl = process.env.MONGODB_URI

  if (!mongoUrl) {
    throw new Error('MONGODB_URI is not defined in environment variables')
  }

  try {
    await mongoose.connect(mongoUrl, {
      family: 4, // Force IPv4
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    isConnected = true
    console.log('[v0] Connected to MongoDB')
  } catch (error) {
    console.error('[v0] MongoDB connection error:', error)
    throw error
  }
}

export async function disconnectDB() {
  if (!isConnected) {
    return
  }

  try {
    await mongoose.disconnect()
    isConnected = false
    console.log('[v0] Disconnected from MongoDB')
  } catch (error) {
    console.error('[v0] MongoDB disconnection error:', error)
    throw error
  }
}
