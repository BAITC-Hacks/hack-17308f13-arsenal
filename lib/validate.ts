import { scenarioSchema } from "./scenario-schema";
import { measures } from "../data/measures";
import { directions } from "../data/rules";
import type { Decision, Direction } from "./types";

type Issue = {
  code:
    | "schema"
    | "count"
    | "duplicate"
    | "district"
    | "budget"
    | "direction"
    | "conflict";
  message: string;
};
// Drafts use the same rules; only the requirement to have exactly five is deferred.
export function validateScenario(
  input: unknown,
  options: { partial?: boolean } = {},
) {
  const issues: Issue[] = [];
  const finish = (spent: number) => ({
    valid: issues.length === 0,
    errors: issues.map((i) => i.message),
    issues,
    spent,
  });
  if (Array.isArray(input) && input.length > 5) {
    issues.push({
      code: "count",
      message: "План заполнен. Удалите мероприятие, чтобы выбрать другое.",
    });
    return finish(0);
  }
  const parsed = scenarioSchema.safeParse({ decisions: input });
  if (!parsed.success) {
    issues.push({
      code: "schema",
      message: "Не удалось распознать мероприятие или район. Проверьте план.",
    });
    return finish(0);
  }
  const decisions = parsed.data.decisions;
  if (!options.partial && decisions.length !== 5)
    issues.push({ code: "count", message: "Выберите ровно пять мероприятий." });
  if (new Set(decisions.map((d) => d.measureId)).size !== decisions.length)
    issues.push({
      code: "duplicate",
      message: "Это мероприятие уже в плане. Выберите другое мероприятие.",
    });
  let spent = 0;
  const counts: Partial<Record<Direction, number>> = {};
  for (const d of decisions) {
    const m = measures.find((m) => m.id === d.measureId)!;
    spent += m.cost;
    counts[m.direction] = (counts[m.direction] ?? 0) + 1;
    if (m.scope === "district" && !d.districtId)
      issues.push({
        code: "district",
        message: `«${m.name}»: выберите район.`,
      });
    if (m.scope === "city" && d.districtId !== undefined)
      issues.push({
        code: "district",
        message: `«${m.name}» действует на весь город: отдельный район указывать нельзя.`,
      });
  }
  if (spent > 100)
    issues.push({
      code: "budget",
      message: `Бюджет плана — ${spent} ед., доступно 100. Удалите мероприятие или выберите более дешёвое.`,
    });
  for (const [dir, count] of Object.entries(counts))
    if (count > 2)
      issues.push({
        code: "direction",
        message: `«${directions[dir as Direction]}»: уже выбраны 2 мероприятия — это максимум. Удалите одно из них или выберите другое направление.`,
      });
  for (const [a, b, same] of [
    ["M1", "M3", false],
    ["M4", "M7", true],
    ["M5", "M13", true],
  ] as const) {
    const x = decisions.find((d) => d.measureId === a),
      y = decisions.find((d) => d.measureId === b);
    if (x && y && (!same || x.districtId === y.districtId)) {
      const names = [a, b].map(
        (id) => `«${measures.find((m) => m.id === id)!.name}»`,
      );
      issues.push({
        code: "conflict",
        message: `${names.join(" и ")} несовместимы${same ? " в одном районе. Выберите другой район для одного из мероприятий или удалите его из плана" : ". Оставьте в плане только одно из этих мероприятий"}.`,
      });
    }
  }
  return finish(spent);
}

// Replacement removes the original decision before checking; never a sixth or duplicate measure.
export function previewDecision(
  decisions: Decision[],
  decision: Decision,
  replace = false,
) {
  const base = replace
    ? decisions.filter((d) => d.measureId !== decision.measureId)
    : decisions;
  const next = replace
    ? decisions.map((d) => (d.measureId === decision.measureId ? decision : d))
    : [...base, decision];
  const validation = validateScenario(next, { partial: true });
  const cost = measures.find((m) => m.id === decision.measureId)?.cost ?? 0;
  const remaining = 100 - validateScenario(base, { partial: true }).spent;
  return {
    ...validation,
    next,
    errors: validation.issues.map((i) =>
      i.code === "budget"
        ? `Не хватает бюджета: нужно ${cost} ед., осталось ${remaining}. Удалите другое мероприятие или выберите более дешёвое.`
        : i.message,
    ),
  };
}
