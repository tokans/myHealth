/**
 * Deterministic hydration target. NOT medical advice — a simple, editable default.
 * ~35 ml/kg/day, one glass ≈ 250 ml, clamped to a sensible 4–14 glasses. Falls
 * back to 8 glasses when weight is unknown.
 */
const ML_PER_GLASS = 250;
const ML_PER_KG = 35;

export function defaultWaterGlasses(weightKg?: number | null): number {
  if (!weightKg || weightKg <= 0) return 8;
  const glasses = Math.round((weightKg * ML_PER_KG) / ML_PER_GLASS);
  return Math.max(4, Math.min(14, glasses));
}

export function hydrationPct(glasses: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((glasses / target) * 100)));
}
