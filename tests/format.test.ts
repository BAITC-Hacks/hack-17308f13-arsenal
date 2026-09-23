import { it, expect } from "vitest";
import { format, signed } from "../lib/format";
import { summarize } from "../lib/simulate";
import { city } from "../data/city";
it("одинаковые дельты округляются одинаково, включая двоичный шум и отрицательные значения", () => {
  for (const n of [1.115, 1.115 - 1e-14, 1.115 + 1e-14, 63.105 - 61.99])
    expect(format(n)).toBe("1,12");
  expect(format(-1.115 - 1e-14)).toBe("-1,12");
  expect(format(1.1149)).toBe("1,11");
  expect(signed(1.115)).toBe("+1,12");
});
it("округление не изменяет расчёт критического порога", () => {
  const d = structuredClone(city);
  d[0].indicators.T1 = 39.99999999999;
  expect(format(d[0].indicators.T1)).toBe("40,00");
  expect(
    summarize(d).critical.some(
      (c) => c.districtId === "esil" && c.indicator === "T1",
    ),
  ).toBe(true);
});

it("склонения для 0, 1, 2, 4, 5 и дробных значений", async () => {
  const { plural } = await import("../lib/format");
  for (const forms of [
    ["мероприятие", "мероприятия", "мероприятий"],
    ["квартал", "квартала", "кварталов"],
    ["показатель", "показателя", "показателей"],
    ["балл", "балла", "баллов"],
  ] as const) {
    expect(
      [0, 1, 2, 4, 5, 11, 21, 1.5].map((n) => plural(n, forms[0], forms[1], forms[2])),
    ).toEqual([
      forms[2],
      forms[0],
      forms[1],
      forms[1],
      forms[2],
      forms[2],
      forms[0],
      forms[1],
    ]);
  }
});
