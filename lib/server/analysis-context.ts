import "server-only";
import { modelAnalysisSchema, analysisSchema } from "../analysis-schema";
import { simulateScenario, type Simulation } from "../simulate";
import { validateScenario } from "../validate";
import { scenarioId } from "../scenario-schema";
import { format, signed } from "../format";
import { city } from "../../data/city";
import { measures } from "../../data/measures";
import { labels, DATA_VERSION } from "../../data/rules";
import type { Decision, Indicator } from "../types";
export const ANALYSIS_VERSION = "grounded-facts-v3";
type Fact = {
  id: string;
  category: "improvement" | "problem" | "detail";
  text: string;
};
export function buildAnalysisContext(
  result: Simulation,
  decisions: Decision[],
) {
  const facts: Fact[] = [
    {
      id: "score",
      category: "improvement",
      text: `Индекс качества жизни: ${format(result.before.score)} → ${format(result.after.score)} (${signed(result.delta)}). Это итоговый индекс, не средняя оценка города.`,
    },
    {
      id: "average",
      category: "detail",
      text: `Средневзвешенная оценка города: ${format(result.before.average)} → ${format(result.after.average)} (${signed(result.after.average - result.before.average)}).`,
    },
    {
      id: "critical",
      category: "problem",
      text: result.after.critical.length
        ? `Остаются критические показатели: ${result.after.critical.map((c) => `${c.districtName} — ${labels[c.indicator]} ${format(c.value)}`).join("; ")}. Порог — строго ниже 40.`
        : "Критических показателей ниже 40 не осталось. Это не означает решения всех проблем города.",
    },
  ];
  for (const d of result.districtDeltas) {
    const district = result.after.districts.find((x) => x.id === d.id)!;
    if (d.score > 0)
      facts.push({
        id: `district:${d.id}`,
        category: "improvement",
        text: `${district.name}: районная оценка выросла на ${format(d.score)}, до ${format(district.score)}. Это оценка района, не итоговый индекс.`,
      });
  }
  for (const m of result.realizedEffects) {
    const scope =
      m.scope === "city"
        ? "во всех пяти районах"
        : `только в районе ${city.find((d) => d.id === m.districtId)!.name}`;
    for (const [key, value] of Object.entries(m.effects))
      facts.push({
        id: `effect:${m.id}:${key}`,
        category: "detail",
        text: `«${m.name}» ${scope}: ${labels[key as Indicator]} ${signed(value)} с учётом задержки. Это эффект на показатель до итогового ограничения 0–100, не вклад в индекс.`,
      });
  }
  for (const s of result.synergies)
    facts.push({
      id: `synergy:${s.pair.replaceAll(" ", "")}`,
      category: "detail",
      text: `Совместный эффект ${s.pair
        .split(" + ")
        .map((id) => `«${measures.find((m) => m.id === id)!.name}»`)
        .join(
          " и ",
        )} действует только в районе ${s.districtName}: ${labels[s.indicator]} ${signed(s.effect)} без уменьшения на задержку.`,
    });
  return {
    dataVersion: DATA_VERSION,
    analysisVersion: ANALYSIS_VERSION,
    synthetic: true,
    baselineScore: result.before.score,
    finalScore: result.after.score,
    scoreDelta: result.delta,
    weightedCityAverage: {
      before: result.before.average,
      after: result.after.average,
      delta: result.after.average - result.before.average,
    },
    minimumDistrictScore: {
      before: result.before.minimum,
      after: result.after.minimum,
    },
    criticalIndicators: {
      before: result.before.critical,
      after: result.after.critical,
    },
    budget: {
      limit: 100,
      spent: result.spent,
      remaining: result.remaining,
      decisionCount: decisions.length,
      scope: "entire_plan",
    },
    districts: result.after.districts.map((d, i) => ({
      id: d.id,
      name: d.name,
      populationShare: d.populationShare,
      before: result.before.districts[i],
      after: d,
    })),
    selectedMeasures: result.realizedEffects.map((m) => ({
      ...m,
      districtId: m.districtId ?? null,
      realizedEffects: m.effects,
    })),
    synergies: result.synergies,
    decomposition: result.decomposition,
    indicatorNames: labels,
    constraints: {
      exactDecisions: 5,
      uniqueMeasures: true,
      maxPerDirection: 2,
      districtRequiredForDistrictMeasures: true,
      districtForbiddenForCityMeasures: true,
      incompatibilities: [
        "M1 + M3: любые районы",
        "M4 + M7: один район",
        "M5 + M13: один район",
      ],
      recommendation:
        "Только замена одной меры или изменение её района, не шестая мера. Сервер проверит весь план.",
    },
    availableCatalog: measures,
    districtIds: city.map((d) => d.id),
    facts,
  };
}
export function verifyAnalysis(
  raw: unknown,
  result: Simulation,
  decisions: Decision[],
) {
  const answer = modelAnalysisSchema.parse(
      typeof raw === "string" ? JSON.parse(raw) : raw,
    ),
    context = buildAnalysisContext(result, decisions);
  const fact = (id: string, category?: Fact["category"]) => {
    const f = context.facts.find((f) => f.id === id);
    if (!f || (category && f.category !== category))
      throw new Error("Unsupported fact reference");
    return f.text;
  };
  const improvement = fact(answer.improvementFactId, "improvement"),
    problem = fact(answer.problemFactId, "problem");
  const details = [...new Set(answer.detailFactIds)].map((id) => fact(id));
  let alternative = null,
    next =
      "Проверьте другой вариант распределения мероприятий. Замените мероприятие или измените его район.";
  if (answer.replacement) {
    const change = answer.replacement,
      removed = decisions.find((d) => d.measureId === change.removeMeasureId);
    const proposed = decisions.map((d) =>
      d.measureId === change.removeMeasureId
        ? {
            measureId: change.addMeasureId,
            ...(change.districtId !== null
              ? { districtId: change.districtId }
              : {}),
          }
        : d,
    );
    if (
      removed &&
      validateScenario(proposed).valid &&
      scenarioId(proposed) !== scenarioId(decisions)
    ) {
      const calculated = simulateScenario(proposed);
      alternative = {
        decisions: proposed,
        score: calculated.after.score,
        scoreDelta: calculated.after.score - result.after.score,
        spent: calculated.spent,
        criticalCount: calculated.after.critical.length,
      };
      const target = measures.find((m) => m.id === change.addMeasureId)!,
        source = measures.find((m) => m.id === change.removeMeasureId)!;
      const place =
        target.scope === "city"
          ? "весь город"
          : city.find((d) => d.id === change.districtId)!.name;
      next =
        change.addMeasureId === change.removeMeasureId
          ? `Проверьте перенос «${target.name}» в район ${place}.`
          : `Проверьте замену «${source.name}» на «${target.name}» (${place}).`;
      next += ` Рассчитанный индекс: ${format(calculated.after.score)} (${signed(alternative.scoreDelta)} к текущему плану), бюджет ${calculated.spent} из 100.`;
    } else
      details.push(
        "Предложенная AI замена не прошла проверку или не меняет план; она не показана как выполнимая альтернатива.",
      );
  }
  return analysisSchema.parse({
    improvement,
    problem,
    next,
    factIds: [
      answer.improvementFactId,
      answer.problemFactId,
      ...answer.detailFactIds,
    ],
    details,
    alternative,
  });
}
