/**
 * Formats a numeric result for a fixed-width display.
 *
 * - Integers within a safe range are shown verbatim.
 * - Other values are rounded to 10 significant figures, which removes IEEE-754
 *   tails such as `0.1 + 0.2 = 0.30000000000000004` while keeping plenty of
 *   precision, and trailing zeros are trimmed.
 * - Anything that would still be long (very large, very small, or many digits)
 *   falls back to compact exponential notation, so the string never runs past
 *   the display or a history row.
 */

const MAX_LENGTH = 14;

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value);

  const rounded = String(Number(value.toPrecision(10)));
  if (rounded.length <= MAX_LENGTH && !rounded.includes("e")) {
    return rounded;
  }
  return value
    .toExponential(5)
    .replace(/\.?0+e/, "e") // drop trailing zeros in the mantissa
    .replace("e+", "e"); // 1.5e+21 -> 1.5e21, keep 1.5e-6
}
