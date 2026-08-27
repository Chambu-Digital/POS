/**
 * Decode your current JWT to see which database you're connected to
 * 
 * Run this while logged in: npx tsx scripts/decode-my-jwt.ts <your_jwt_token>
 * 
 * Or get the token from browser:
 * 1. Open DevTools → Application → Cookies
 * 2. Find 'auth_token' cookie
 * 3. Copy the value
 * 4. Run: npx tsx scripts/decode-my-jwt.ts <paste_token_here>
 */

const token = process.argv[2]

if (!token) {
  console.log('❌ No token provided')
  console.log('\nUsage: npx tsx scripts/decode-my-jwt.ts <your_jwt_token>')
  console.log('\nGet your JWT from browser:')
  console.log('  1. Open DevTools (F12)')
  console.log('  2. Go to Application tab → Cookies')
  console.log('  3. Find "auth_token" cookie')
  console.log('  4. Copy its value')
  console.log('  5. Run this script with that value')
  process.exit(1)
}

try {
  // JWT is base64url encoded, split by dots
  const [header, payload, signature] = token.split('.')
  
  // Decode payload (add padding if needed)
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const paddedBase64 = base64 + '='.repeat((4 - base64.length % 4) % 4)
  const decoded = Buffer.from(paddedBase64, 'base64').toString('utf8')
  const data = JSON.parse(decoded)
  
  console.log('🔐 JWT PAYLOAD:\n')
  console.log('User ID:', data.userId)
  console.log('Type:', data.type)
  console.log('Email:', data.email || 'N/A')
  console.log('\n📊 MongoDB URI:', data.mongoUri || '❌ NOT SET')
  
  if (data.mongoUri) {
    // Extract database name from URI
    const dbMatch = data.mongoUri.match(/\/([^/?]+)(\?|$)/)
    const dbName = dbMatch ? dbMatch[1] : 'UNKNOWN'
    console.log('📂 Database Name:', dbName)
    
    if (dbName !== 'jaywines') {
      console.log('\n⚠️  WARNING: You are connected to "' + dbName + '", NOT "jaywines"!')
      console.log('   This is why our scripts found no data.')
      console.log('\n💡 Update scripts to use:', dbName)
    } else {
      console.log('\n✅ You are connected to jaywines database')
    }
  } else {
    console.log('\n⚠️  No mongoUri in JWT - using default MONGODB_URI')
  }
  
  console.log('\n🔑 Tenant Features:', data.tenantFeatures || {})
  
} catch (error: any) {
  console.error('❌ Error decoding JWT:', error.message)
  console.log('\nMake sure you copied the entire token')
}
