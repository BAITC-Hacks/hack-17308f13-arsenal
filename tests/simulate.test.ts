import { describe, it, expect } from "vitest";
import {
  calculateBaseline,
  simulateScenario,
  summarize,
  clip,
} from "../lib/simulate";
import { city } from "../data/city";
import { example } from "../data/example";
import { keys, weights } from "../data/rules";
import type { Decision } from "../lib/types";
const pick = (ids: string[]): Decision[] =>
  ids.map((measureId) => ({
    measureId,
    ...(["M2", "M6", "M12", "M14"].includes(measureId)
      ? {}
      : { districtId: "nura" }),
  }));
describe("Расчёт", () => {
  it("исходные значения и веса", () => {
    const b = calculateBaseline();
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(city.reduce((a, b) => a + b.populationShare, 0)).toBeCloseTo(1);
    [62.99, 57.06, 54.65, 56.63, 49.18].forEach((v, i) =>
      expect(b.districts[i].score).toBeCloseTo(v, 8),
    );
    expect(b.average).toBeCloseTo(56.8624, 8);
    expect(b.critical).toHaveLength(2);
    expect(b.score).toBeCloseTo(52.55768, 8);
  });
  it("контрольный пример", () => {
    const r = simulateScenario(example);
    [63.4275, 57.4975, 56.3, 57.0675, 52.9625].forEach((v, i) =>
      expect(r.after.districts[i].score).toBeCloseTo(v, 8),
    );
    expect(r.spent).toBe(95);
    expect(r.after.average).toBeCloseTo(58.0776, 8);
    expect(r.after.score).toBeCloseTo(56.54307, 8);
    expect(r.delta).toBeCloseTo(3.98539, 8);
    expect(r.after.critical).toHaveLength(0);
    expect(
      Object.values(r.decomposition).reduce((a, b) => a + b, 0),
    ).toBeCloseTo(r.delta, 10);
  });
  it("городской эффект во всех районах", () => {
    const r = simulateScenario(example);
    r.after.districts.forEach((d, i) =>
      expect(d.indicators.C2 - city[i].indicators.C2).toBe(4.375),
    );
  });
  it("40 не критическое, Score не ограничен", () => {
    const d = structuredClone(city);
    d.forEach((d) => keys.forEach((k) => (d.indicators[k] = 40)));
    expect(summarize(d).critical).toHaveLength(0);
    d.forEach((d) => keys.forEach((k) => (d.indicators[k] = 0)));
    expect(summarize(d).score).toBe(-50);
  });
  it("отрицательный эффект с лагом", () => {
    const r = simulateScenario(pick(["M11", "M12", "M14", "M7", "M8"]));
    expect(r.after.districts[4].indicators.T1).toBe(53.25);
  });
  it.each([
    ["M1", "M2", "M9", "M10", "M12", "T1"],
    ["M10", "M12", "M7", "M8", "M14", "B1"],
    ["M5", "M6", "M9", "M10", "M12", "E2"],
  ])("фиксированная синергия %s + %s", (a, b, c, d, e, k) => {
    const r = simulateScenario(pick([a, b, c, d, e]));
    expect(r.synergies.find((s) => s.pair === `${a} + ${b}`)).toMatchObject({
      effect: 2,
      indicator: k,
      districtId: "nura",
    });
    const realized = r.realizedEffects.reduce(
      (s, m) => s + (m.effects[k as keyof typeof m.effects] ?? 0),
      0,
    );
    expect(
      r.after.districts[4].indicators[k as keyof typeof weights] -
        city[4].indicators[k as keyof typeof weights],
    ).toBe(realized + 2);
  });
  it("порядок и повторный расчёт не меняют данные", () => {
    const snapshot = JSON.stringify(city);
    const r = simulateScenario(example);
    expect(simulateScenario([...example].reverse())).toEqual(r);
    expect(simulateScenario(example)).toEqual(r);
    expect(JSON.stringify(city)).toBe(snapshot);
  });
  it("clip после суммы, включая нижнюю границу", () => {
    expect(clip(110 - 15)).toBe(95);
    expect(clip(120)).toBe(100);
    expect(clip(-3)).toBe(0);
    const original = city[4].indicators.B1;
    try {
      city[4].indicators.B1 = 99;
      const r = simulateScenario(example);
      expect(r.after.districts[4].indicators.B1).toBe(100);
      r.after.districts.forEach((d) =>
        keys.forEach((k) => {
          expect(d.indicators[k]).toBeGreaterThanOrEqual(0);
          expect(d.indicators[k]).toBeLessThanOrEqual(100);
        }),
      );
    } finally {
      city[4].indicators.B1 = original;
    }
  });
  it("невалидный сценарий без Score", () =>
    expect(() => simulateScenario([])).toThrow());
});

it("ограничение выполняется после всех положительных и отрицательных эффектов", () => {
  const original = city[4].indicators.T1;
  try {
    city[4].indicators.T1 = 0.5;
    const r = simulateScenario(pick(["M2", "M11", "M7", "M8", "M12"]));
    expect(r.after.districts[4].indicators.T1).toBe(1.75);
  } finally {
    city[4].indicators.T1 = original;
  }
});
