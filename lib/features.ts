// ─── Backward-compat re-exports ────────────────────────────────────────────────
// lib/modules.ts is now the source of truth.
// This file keeps old imports working during the transition.

import {
  MODULES, ALL_FEATURES, DEFAULT_MODULE_FEATURES, normaliseFeatures,
  type ModuleFeature,
} from '@/lib/modules'

export type FeatureDefinition = ModuleFeature

/** Flat list of all features — same shape as the old FEATURES array */
export const FEATURES: FeatureDefinition[] = ALL_FEATURES

/** Default feature flags — now uses dotted keys */
export const DEFAULT_FEATURES: Record<string, boolean> = DEFAULT_MODULE_FEATURES

export { MODULES, normaliseFeatures }
