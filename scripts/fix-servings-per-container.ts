/**
 * Fix servingsPerContainer for all broken servings
 * 
 * Standard values for 750ml bottles:
 * - Tot (25ml): 30 servings per bottle
 * - Quarter (187.5ml): 4 servings per bottle  
 * - Half (375ml): 2 servings per bottle
 * - Full (750ml): 1 serving per bottle
 * - Glass (wine, 125ml): 6 servings per bottle
 * - Half-btl (wine, 375ml): 2 servings (half bottle)
 * 
 * Run: npx tsx scripts/fix-servings-per-container.ts
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import { barServingSchema } from '@/lib/models/schemas'

dotenv.config()

async function fixServings() {
  const baseUri = process.env.MONGODB_URI!
  const tenantUri = baseUri.replace('/?', '/jaywines?')
  
  await mongoose.connect(tenantUri)
  console.log('✅ Connected to jaywines\n')

  const BarServing = mongoose.model('BarServing', barServingSchema)

  // Define serving sizes (standard for 750ml bottles)
  const servingSizes: Record<string, number> = {
    'tot': 30,        // 25ml per tot, 30 tots in 750ml
    'quarter': 4,     // 187.5ml per quarter
    'half': 2,        // 375ml per half
    'full': 1,        // 750ml full bottle
    'glass': 6,       // 125ml wine glass, 6 glasses in 750ml
    'half-btl': 2,    // Half bottle (wine)
  }

  const brokenServings = await BarServing.find({
    $or: [
      { servingsPerContainer: { $exists: false } },
      { servingsPerContainer: null },
      { servingsPerContainer: { $lte: 0 } },
    ]
  })

  console.log(`🔧 FIXING ${brokenServings.length} SERVINGS:\n`)

  let fixed = 0
  let skipped = 0

  for (const serving of brokenServings) {
    const servingName = serving.name.toLowerCase()
    let servingsPerContainer: number | undefined

    // Match serving name to standard size
    for (const [key, value] of Object.entries(servingSizes)) {
      if (servingName.includes(key)) {
        servingsPerContainer = value
        break
      }
    }

    if (servingsPerContainer) {
      serving.servingsPerContainer = servingsPerContainer
      await serving.save()
      console.log(`✅ Fixed: ${serving.name} → ${servingsPerContainer} servings per container`)
      fixed++
    } else {
      console.log(`⚠️  Skipped: ${serving.name} (unknown type, needs manual fix)`)
      skipped++
    }
  }

  console.log(`\n📊 SUMMARY:`)
  console.log(`   Fixed: ${fixed}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Total: ${brokenServings.length}`)

  if (skipped > 0) {
    console.log(`\n💡 Manual fix needed for ${skipped} serving(s)`)
    console.log(`   Go to Bar Inventory → Edit product → Set servingsPerContainer`)
  }

  await mongoose.disconnect()
  console.log('\n✅ Done!')
}

fixServings().catch(console.error)
