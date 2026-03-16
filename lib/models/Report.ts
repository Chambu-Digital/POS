import mongoose from 'mongoose'

export interface IReport extends mongoose.Document {
  userId: string
  reportType: 'sales' | 'inventory' | 'profit' | 'custom' | 'rentals'
  title: string
  description?: string
  dateRange: {
    startDate: Date
    endDate: Date
  }
  data: {
    summary: {
      totalSales?: number
      totalRevenue?: number
      totalProfit?: number
      totalItems?: number
      totalProducts?: number
      lowStockItems?: number
      outOfStockItems?: number
      [key: string]: any
    }
    details: any[]
    charts?: {
      salesByDay?: any[]
      salesByCategory?: any[]
      topProducts?: any[]
      [key: string]: any
    }
  }
  generatedAt: Date
  createdAt: Date
  updatedAt: Date
}

const reportSchema = new mongoose.Schema<IReport>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    reportType: {
      type: String,
      enum: ['sales', 'inventory', 'profit', 'custom', 'rentals'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    dateRange: {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
    },
    data: {
      summary: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      details: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
      },
      charts: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

// Index for efficient querying
reportSchema.index({ userId: 1, reportType: 1, createdAt: -1 })

// Clear cached model to pick up schema changes
if (mongoose.models.Report) delete mongoose.models.Report

export default mongoose.model<IReport>('Report', reportSchema)

