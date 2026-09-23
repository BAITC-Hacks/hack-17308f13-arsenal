// Presentation only: remove sub-picounit binary noise before decimal rounding.
// This never feeds simulation, thresholds or validation.
const displayValue = (n: number) => Number(n.toFixed(10));
export const format = (n: number) =>
  displayValue(n).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const signed = (n: number) =>
  (displayValue(n) >= 0 ? "+" : "") + format(n);

// Russian noun forms, including fractional values and 11–14.
export function plural(n: number, one: string, few: string, many: string) {
  const value = Math.abs(n);
  if (!Number.isInteger(value)) return few;
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  const last = value % 10;
  return last === 1 ? one : last >= 2 && last <= 4 ? few : many;
}
