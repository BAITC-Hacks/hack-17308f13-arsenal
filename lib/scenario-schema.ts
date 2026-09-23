import { z } from "zod";
import { city } from "../data/city";
import { measures } from "../data/measures";
import type { Decision } from "./types";
export const decisionSchema = z.strictObject({
  measureId: z
    .string()
    .refine(
      (id) => measures.some((m) => m.id === id),
      "Неизвестное мероприятие",
    ),
  districtId: z
    .string()
    .refine((id) => city.some((d) => d.id === id), "Неизвестный район")
    .optional(),
});
export const scenarioSchema = z.strictObject({
  decisions: z.array(decisionSchema).max(5),
});
export function normalize(decisions: Decision[]) {
  return [...decisions]
    .map((d) =>
      d.districtId
        ? { measureId: d.measureId, districtId: d.districtId }
        : { measureId: d.measureId },
    )
    .sort((a, b) => a.measureId.localeCompare(b.measureId));
}
export function scenarioId(decisions: Decision[]) {
  return JSON.stringify(normalize(decisions));
}
