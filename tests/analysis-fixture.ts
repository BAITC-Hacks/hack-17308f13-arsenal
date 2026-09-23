import type { Analysis } from "../lib/analysis-schema";
export const modelAnswer = JSON.stringify({
  improvementFactId: "score",
  problemFactId: "critical",
  detailFactIds: ["average"],
  replacement: null,
});
export const analysisFixture = (text = "Тестовый разбор"): Analysis => ({
  improvement: text,
  problem: "Тестовая проблема",
  next: "Проверьте другой вариант распределения мер.",
  factIds: ["score", "critical"],
  details: ["Тестовые подробности"],
  alternative: null,
});
