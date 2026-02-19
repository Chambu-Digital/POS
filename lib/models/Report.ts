import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
  _id: string;
  userId: string;
  type: 'sales' | 'inventory' | 'staff' | 'financial';
  title: string;
  data: any;
  dateRange: {
    start: Date;
    end: Date;
  };
  generatedAt: Date;
  parameters?: any;
}

const ReportSchema = new Schema<IReport>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['sales', 'inventory', 'staff', 'financial']
  },
  title: {
    type: String,
    required: true
  },
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  dateRange: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  parameters: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
ReportSchema.index({ userId: 1, type: 1 });
ReportSchema.index({ generatedAt: -1 });

export default mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);