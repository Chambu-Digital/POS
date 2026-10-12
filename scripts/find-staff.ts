import mongoose from 'mongoose'

async function main() {
  const uri = 'mongodb://jayjeremy2000:chambupos@ac-hyykgmq-shard-00-00.h48fu.mongodb.net:27017,ac-hyykgmq-shard-00-01.h48fu.mongodb.net:27017,ac-hyykgmq-shard-00-02.h48fu.mongodb.net:27017/?ssl=true&replicaSet=atlas-15u5t1-shard-0&authSource=admin&retryWrites=true&w=majority'
  
  await mongoose.connect(uri)
  const db = mongoose.connection.db!
  
  const email = 'terrymoraa201@gmail.com'
  
  console.log(`\n🔍 Searching for staff: ${email}\n`)
  
  const staff = await db.collection('staffs').findOne({ email })
  
  if (staff) {
    console.log('✅ Found staff record:')
    console.log(`   Name: ${staff.name}`)
    console.log(`   Email: ${staff.email}`)
    console.log(`   Role: ${staff.role}`)
    console.log(`   branchId: ${staff.branchId || 'NOT ASSIGNED'}`)
    console.log(`   managerOfBranches: ${staff.managerOfBranches ? JSON.stringify(staff.managerOfBranches) : 'None'}`)
    
    if (staff.branchId) {
      const branch = await db.collection('branches').findOne({ _id: staff.branchId })
      if (branch) {
        console.log(`\n📍 Assigned Branch:`)
        console.log(`   Name: ${branch.name}`)
        console.log(`   Code: ${branch.code}`)
        console.log(`   Status: ${branch.status}`)
      } else {
        console.log(`\n⚠️  branchId exists but branch not found in DB`)
      }
    }
    
    if (staff.managerOfBranches && staff.managerOfBranches.length > 0) {
      console.log(`\n👔 Manages ${staff.managerOfBranches.length} branch(es):`)
      for (const bid of staff.managerOfBranches) {
        const branch = await db.collection('branches').findOne({ _id: bid })
        if (branch) {
          console.log(`   - ${branch.name} (${branch.code})`)
        }
      }
    }
  } else {
    console.log(`❌ No staff found with email: ${email}`)
  }
  
  await mongoose.disconnect()
}

main().catch(console.error)
