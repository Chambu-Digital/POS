import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface POS_DB extends DBSchema {
  products: {
    key: string
    value: {
      _id: string
      userId: string
      productName: string
      category: string
      stock: number
      sellingPrice: number
      buyingPrice: number
      [key: string]: any
    }
  }
  categories: {
    key: string
    value: {
      _id: string
      userId: string
      name: string
      description: string
      productCount: number
      color: string
      icon: string
      isActive: boolean
      createdAt: string
      updatedAt: string
    }
  }
  pending_sales: {
    key: string
    value: {
      id: string
      userId: string
      items: Array<{
        productId: string
        quantity: number
        price: number
        discount: number
      }>
      subtotal: number
      discount: number
      total: number
      paymentMethod: string
      createdAt: number
      synced?: boolean
    }
  }
  sales: {
    key: string
    value: {
      _id: string
      userId: string
      items: any[]
      subtotal: number
      discount: number
      total: number
      paymentMethod: string
      createdAt: string
      synced: boolean
    }
  }
  staff: {
    key: string
    value: {
      _id: string
      name: string
      role: string
      email: string
    }
  }
  conflicts: {
    key: string
    value: {
      id: string
      type: 'sale' | 'product'
      localData: any
      serverData: any
      detectedAt: number
      resolved: boolean
    }
  }
  sync_meta: {
    key: string
    value: {
      lastSync: number
      status: 'synced' | 'pending'
    }
  }
}

let db: IDBPDatabase<POS_DB> | null = null

export async function initDB(): Promise<IDBPDatabase<POS_DB>> {
  if (db) return db

  db = await openDB<POS_DB>('pos-system', 3, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: '_id' })
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: '_id' })
      }
      if (!db.objectStoreNames.contains('pending_sales')) {
        db.createObjectStore('pending_sales', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('sales')) {
        db.createObjectStore('sales', { keyPath: '_id' })
      }
      if (!db.objectStoreNames.contains('staff')) {
        db.createObjectStore('staff', { keyPath: '_id' })
      }
      if (!db.objectStoreNames.contains('conflicts')) {
        db.createObjectStore('conflicts', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('sync_meta')) {
        db.createObjectStore('sync_meta')
      }
    },
  })

  return db
}

// Products operations
export async function cacheProducts(products: any[]) {
  const database = await initDB()
  const tx = database.transaction('products', 'readwrite')

  // Clear old products
  await tx.objectStore('products').clear()

  // Add new products
  for (const product of products) {
    await tx.objectStore('products').put(product)
  }

  await tx.done
}

export async function clearCachedProducts() {
  const database = await initDB()
  await database.clear('products')
}

export async function getCachedProducts(): Promise<any[]> {
  const database = await initDB()
  return database.getAll('products')
}

export async function getCachedProduct(id: string): Promise<any | undefined> {
  const database = await initDB()
  return database.get('products', id)
}

// Pending sales operations
export async function addPendingSale(saleData: any) {
  const database = await initDB()
  const id = `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  await database.put('pending_sales', {
    ...saleData,
    id,
    createdAt: Date.now(),
    synced: false,
  })

  return id
}

export async function getPendingSales(): Promise<any[]> {
  const database = await initDB()
  return database.getAll('pending_sales')
}

export async function removePendingSale(id: string) {
  const database = await initDB()
  await database.delete('pending_sales', id)
}

export async function clearPendingSales() {
  const database = await initDB()
  await database.clear('pending_sales')
}

// Sync metadata
export async function getLastSyncTime(): Promise<number> {
  const database = await initDB()
  const meta = await database.get('sync_meta', 'products')
  return meta?.lastSync || 0
}

export async function updateSyncTime() {
  const database = await initDB()
  await database.put('sync_meta', {
    lastSync: Date.now(),
    status: 'synced',
  }, 'products')
}

export async function setSyncPending() {
  const database = await initDB()
  const meta = await database.get('sync_meta', 'products')
  await database.put('sync_meta', {
    lastSync: meta?.lastSync || Date.now(),
    status: 'pending',
  }, 'products')
}

// Utility to check if online
export function isOnline(): boolean {
  return typeof window !== 'undefined' && navigator.onLine
}

// Sales operations (for backup/restore)
// These functions cache sales data in IndexedDB for backup purposes
export async function cacheSales(sales: any[]) {
  const database = await initDB()
  const tx = database.transaction('sales', 'readwrite')

  for (const sale of sales) {
    await tx.objectStore('sales').put({ ...sale, synced: true })
  }

  await tx.done
}

export async function getCachedSales(): Promise<any[]> {
  const database = await initDB()
  return database.getAll('sales')
}

export async function addCachedSale(sale: any) {
  const database = await initDB()
  await database.put('sales', { ...sale, synced: false })
}

// Staff operations (for backup/restore)
export async function cacheStaff(staff: any[]) {
  const database = await initDB()
  const tx = database.transaction('staff', 'readwrite')

  await tx.objectStore('staff').clear()

  for (const member of staff) {
    await tx.objectStore('staff').put(member)
  }

  await tx.done
}

export async function getCachedStaff(): Promise<any[]> {
  const database = await initDB()
  return database.getAll('staff')
}

// Conflict operations
export async function addConflict(type: 'sale' | 'product', localData: any, serverData: any) {
  const database = await initDB()
  const id = `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  await database.put('conflicts', {
    id,
    type,
    localData,
    serverData,
    detectedAt: Date.now(),
    resolved: false,
  })

  return id
}

export async function getConflicts(): Promise<any[]> {
  const database = await initDB()
  const conflicts = await database.getAll('conflicts')
  return conflicts.filter(c => !c.resolved)
}

export async function resolveConflict(id: string) {
  const database = await initDB()
  const conflict = await database.get('conflicts', id)
  
  if (conflict) {
    await database.put('conflicts', {
      ...conflict,
      resolved: true,
    })
  }
}

export async function clearResolvedConflicts() {
  const database = await initDB()
  const conflicts = await database.getAll('conflicts')
  const tx = database.transaction('conflicts', 'readwrite')

  for (const conflict of conflicts) {
    if (conflict.resolved) {
      await tx.objectStore('conflicts').delete(conflict.id)
    }
  }

  await tx.done
}

// Category operations
export async function cacheCategories(categories: any[]) {
  const database = await initDB()
  const tx = database.transaction('categories', 'readwrite')

  await tx.objectStore('categories').clear()

  for (const category of categories) {
    await tx.objectStore('categories').put(category)
  }

  await tx.done
}

export async function getCachedCategories(): Promise<any[]> {
  const database = await initDB()
  return database.getAll('categories')
}

export async function getCachedCategory(id: string): Promise<any | undefined> {
  const database = await initDB()
  return database.get('categories', id)
}

export async function addCachedCategory(category: any) {
  const database = await initDB()
  await database.put('categories', category)
}

export async function updateCachedCategory(id: string, updates: any) {
  const database = await initDB()
  const category = await database.get('categories', id)

  if (category) {
    await database.put('categories', { ...category, ...updates })
  }
}

export async function deleteCachedCategory(id: string) {
  const database = await initDB()
  await database.delete('categories', id)
}

// Barcode lookup — searches cached products by barcode field
export async function getProductByBarcode(barcode: string): Promise<any | undefined> {
  const database = await initDB()
  const all = await database.getAll('products')
  return all.find((p) => p.barcode && p.barcode === barcode)
}
