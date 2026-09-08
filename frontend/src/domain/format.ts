/**
 * Formats a numeric result for display.
 *
 * Integers are shown as-is. Other values are rounded to 12 significant figures,
 * which removes IEEE-754 tails such as `0.1 + 0.2 = 0.30000000000000004`
 * without discarding meaningful precision, then trailing zeros are trimmed.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Number(value.toPrecision(12)));
}
