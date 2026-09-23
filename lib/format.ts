export const format = (n: number) =>
  n.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const signed = (n: number) => (n >= 0 ? "+" : "") + format(n);
