import { city } from "../data/city";
import { measures } from "../data/measures";
import { keys, weights, synergyRules } from "../data/rules";
import { validateScenario } from "./validate";
import { normalize, scenarioId } from "./scenario-schema";
import type { Decision, District, Indicators } from "./types";
export const clip = (value: number) => Math.max(0, Math.min(100, value));
export function summarize(districts: District[]) {
  const rows = districts.map((d) => ({
    ...d,
    score: keys.reduce((s, k) => s + weights[k] * d.indicators[k], 0),
  }));
  const average = rows.reduce((s, d) => s + d.populationShare * d.score, 0),
    minimum = Math.min(...rows.map((d) => d.score));
  const critical = rows.flatMap((d) =>
    keys
      .filter((k) => d.indicators[k] < 40)
      .map((k) => ({
        districtId: d.id,
        districtName: d.name,
        indicator: k,
        value: d.indicators[k],
      })),
  );
  return {
    districts: rows,
    average,
    minimum,
    critical,
    score: 0.7 * average + 0.3 * minimum - critical.length,
  };
}
export function calculateBaseline() {
  return summarize(structuredClone(city));
}
export function simulateScenario(input: Decision[]) {
  const validation = validateScenario(input);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  const decisions = normalize(input),
    before = calculateBaseline(),
    districts = structuredClone(city);
  const realizedEffects = decisions.map((d) => {
    const m = measures.find((m) => m.id === d.measureId)!;
    const effects = Object.fromEntries(
      Object.entries(m.effects).map(([k, v]) => [k, (v * (8 - m.lag)) / 8]),
    ) as Partial<Indicators>;
    for (const district of districts)
      if (m.scope === "city" || district.id === d.districtId)
        for (const k of keys) district.indicators[k] += effects[k] ?? 0;
    return { ...m, districtId: d.districtId, effects };
  });
  const synergies = synergyRules.flatMap(([a, b, indicator]) => {
    const first = decisions.find((d) => d.measureId === a);
    if (!first || !decisions.some((d) => d.measureId === b)) return [];
    const district = districts.find((d) => d.id === first.districtId)!;
    district.indicators[indicator] += 2;
    return [
      {
        pair: `${a} + ${b}`,
        districtId: district.id,
        districtName: district.name,
        indicator,
        effect: 2,
      },
    ];
  });
  for (const d of districts)
    for (const k of keys) d.indicators[k] = clip(d.indicators[k]);
  const after = summarize(districts);
  return {
    scenarioId: scenarioId(decisions),
    before,
    after,
    delta: after.score - before.score,
    spent: validation.spent,
    remaining: 100 - validation.spent,
    realizedEffects,
    synergies,
    districtDeltas: after.districts.map((d, i) => ({
      id: d.id,
      score: d.score - before.districts[i].score,
      indicators: Object.fromEntries(
        keys.map((k) => [
          k,
          d.indicators[k] - before.districts[i].indicators[k],
        ]),
      ) as Indicators,
    })),
    decomposition: {
      average: 0.7 * (after.average - before.average),
      minimum: 0.3 * (after.minimum - before.minimum),
      penalty: before.critical.length - after.critical.length,
    },
  };
}
export type Simulation = ReturnType<typeof simulateScenario>;
