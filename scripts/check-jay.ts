import mongoose from 'mongoose'

async function main() {
  const uri = 'mongodb://jayjeremy2000:chambupos@ac-hyykgmq-shard-00-00.h48fu.mongodb.net:27017,ac-hyykgmq-shard-00-01.h48fu.mongodb.net:27017,ac-hyykgmq-shard-00-02.h48fu.mongodb.net:27017/?ssl=true&replicaSet=atlas-15u5t1-shard-0&authSource=admin&retryWrites=true&w=majority'
  
  await mongoose.connect(uri)
  const db = mongoose.connection.db!
  
  console.log('\n📊 ALL STAFF IN WONDER SHOPS\n')
  
  const allStaff = await db.collection('staffs').find({}).toArray()
  
  console.log(`Total staff: ${allStaff.length}\n`)
  allStaff.forEach((s: any) => {
    console.log(`Name: ${s.name}`)
    console.log(`  Email: ${s.email || 'N/A'}`)
    console.log(`  Role: ${s.role}`)
    console.log(`  managerOfBranches: ${s.managerOfBranches ? JSON.stringify(s.managerOfBranches) : 'N/A'}`)
    console.log(`  branchId: ${s.branchId || 'N/A'}`)
    console.log()
  })
  
  await mongoose.disconnect()
}

main().catch(console.error)
