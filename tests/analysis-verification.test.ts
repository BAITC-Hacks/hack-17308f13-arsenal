import { it, expect } from "vitest";
import {
  buildAnalysisContext,
  verifyAnalysis,
} from "../lib/server/analysis-context";
import { simulateScenario } from "../lib/simulate";
import { example } from "../data/example";
import { format } from "../lib/format";
import { modelAnswer } from "./analysis-fixture";
import type { Decision } from "../lib/types";
const screenshotPlan: Decision[] = [
  { measureId: "M1", districtId: "saryarka" },
  { measureId: "M2" },
  { measureId: "M4", districtId: "saryarka" },
  { measureId: "M8", districtId: "saryarka" },
  { measureId: "M14" },
];
it("контрольный сценарий: 91/100, индекс 54,16, Нура остаётся критической", () => {
  const r = simulateScenario(screenshotPlan),
    c = buildAnalysisContext(r, screenshotPlan);
  expect(r.spent).toBe(91);
  expect(r.remaining).toBe(9);
  expect(format(r.after.score)).toBe("54,16");
  expect(c.baselineScore).toBeCloseTo(52.55768, 8);
  expect(c.scoreDelta).not.toBe(c.weightedCityAverage.delta);
  expect(c.budget.decisionCount).toBe(5);
  expect(
    c.criticalIndicators.after.map((x) => [x.districtId, x.indicator, x.value]),
  ).toEqual([
    ["nura", "S1", 38],
    ["nura", "S2", 35],
  ]);
  expect(c.selectedMeasures.find((m) => m.id === "M1")).toMatchObject({
    scope: "district",
    districtId: "saryarka",
    realizedEffects: { T1: 4.5, T2: 6.75 },
  });
  expect(
    c.selectedMeasures.find((m) => m.id === "M14")?.realizedEffects.C1,
  ).toBe(4.375);
  expect(c.synergies[0]).toMatchObject({
    pair: "M1 + M2",
    districtId: "saryarka",
  });
  expect(c.facts.find((f) => f.id === "effect:M1:C1")).toBeUndefined();
  expect(c.facts.find((f) => f.id === "effect:M1:T1")?.text).toContain(
    "только в районе Сарыарка",
  );
});
it("неизвестные факты, подмена категории и лишний свободный текст отклоняются", () => {
  const r = simulateScenario(example),
    valid = JSON.parse(modelAnswer);
  for (const raw of [
    { ...valid, improvementFactId: "effect:M2:C1" },
    { ...valid, problemFactId: "score" },
    { ...valid, detailFactIds: ["invented"] },
    { ...valid, claim: "Нагрузка на инфраструктуру выросла" },
    "not json",
  ])
    expect(() => verifyAnalysis(raw, r, example)).toThrow();
});
it("валидная замена рассчитывается кодом без выдуманных чисел", () => {
  const r = simulateScenario(screenshotPlan),
    raw = {
      ...JSON.parse(modelAnswer),
      replacement: {
        removeMeasureId: "M4",
        addMeasureId: "M7",
        districtId: "nura",
      },
    };
  const analysis = verifyAnalysis(raw, r, screenshotPlan);
  expect(analysis.alternative?.spent).toBe(100);
  expect(analysis.alternative?.decisions).toHaveLength(5);
  const check = simulateScenario(analysis.alternative!.decisions);
  expect(analysis.alternative?.score).toBe(check.after.score);
  expect(analysis.alternative?.scoreDelta).toBe(
    check.after.score - r.after.score,
  );
});
it("перенос района проверен; невалидные замены и шестая мера не выдаются как выполнимые", () => {
  const r = simulateScenario(example),
    raw = JSON.parse(modelAnswer);
  const relocated = verifyAnalysis(
    {
      ...raw,
      replacement: {
        removeMeasureId: "M7",
        addMeasureId: "M7",
        districtId: "esil",
      },
    },
    r,
    example,
  );
  expect(
    relocated.alternative?.decisions.find((d) => d.measureId === "M7")
      ?.districtId,
  ).toBe("esil");
  for (const replacement of [
    { removeMeasureId: "M12", addMeasureId: "M3", districtId: "nura" },
    { removeMeasureId: "M5", addMeasureId: "M7", districtId: "nura" },
    { removeMeasureId: "M99", addMeasureId: "M9", districtId: "nura" },
    { removeMeasureId: "M12", addMeasureId: "M14", districtId: "nura" },
    { removeMeasureId: "M7", addMeasureId: "M7", districtId: "nura" },
  ]) {
    const a = verifyAnalysis({ ...raw, replacement }, r, example);
    expect(a.alternative).toBeNull();
    expect(a.next).toContain("Проверьте другой вариант");
  }
  expect(() =>
    verifyAnalysis(
      {
        ...raw,
        replacement: {
          removeMeasureId: "M7",
          addMeasureId: "M8",
          districtId: "nura",
          score: 100,
        },
      },
      r,
      example,
    ),
  ).toThrow();
});
it("короткие выводы и подробности сформированы только из существующих фактов", () => {
  const r = simulateScenario(example),
    a = verifyAnalysis(modelAnswer, r, example);
  expect(a.improvement).toContain("Индекс качества жизни");
  expect(a.improvement).toContain("56,54");
  expect(a.details[0]).toContain("Средневзвешенная оценка города");
  expect(a.problem).toContain("не осталось");
});
