// ─── Report type definitions ───────────────────────────────────────────────────
// Maps report types to their required features/modules

export interface ReportTypeDefinition {
  value: string
  label: string
  description: string
  /** Required feature key (from lib/modules.ts) — report only shown if tenant has this feature */
  requiredFeature?: string
}

export const REPORT_TYPES: ReportTypeDefinition[] = [
  {
    value: 'sales',
    label: 'Sales Report',
    description: 'Overall sales across all modules',
    // No requiredFeature — sales report is always available
  },
  {
    value: 'inventory',
    label: 'Inventory Report',
    description: 'Stock levels and valuation',
    requiredFeature: 'pos.inventory',
  },
  {
    value: 'profit',
    label: 'Profit Report',
    description: 'Revenue, cost and profit analysis',
    // No requiredFeature — profit report aggregates across all enabled modules
  },
  {
    value: 'kitchen',
    label: 'Kitchen Report',
    description: 'Kitchen orders and performance',
    requiredFeature: 'kds.chef',
  },
  {
    value: 'bar',
    label: 'Bar Report',
    description: 'Bar sales and top items',
    requiredFeature: 'bar.tabs',
  },
  {
    value: 'rental',
    label: 'Rental Services Report',
    description: 'Rental bookings and revenue',
    requiredFeature: 'rentals.bookings',
  },
]

/**
 * Returns report types available to a tenant based on their enabled features.
 * Matches sidebar filtering logic - simply checks if required feature is enabled.
 * @param enabledFeatures - Record of feature keys to boolean values
 */
export function getAvailableReportTypes(
  enabledFeatures: Record<string, boolean>
): ReportTypeDefinition[] {
  return REPORT_TYPES.filter((reportType) => {
    // If no feature required, always show (e.g., Sales, Profit)
    if (!reportType.requiredFeature) return true
    
    // Otherwise check if feature is explicitly enabled
    return enabledFeatures[reportType.requiredFeature] === true
  })
}
