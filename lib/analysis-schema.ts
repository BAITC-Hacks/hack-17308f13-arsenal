import { z } from "zod";
// The model selects existing facts rather than supplying unchecked prose or numbers.
export const modelAnalysisSchema = z.strictObject({
  improvementFactId: z.string().min(1).max(100),
  problemFactId: z.string().min(1).max(100),
  detailFactIds: z.array(z.string().min(1).max(100)).max(6),
  replacement: z
    .strictObject({
      removeMeasureId: z.string().min(1).max(20),
      addMeasureId: z.string().min(1).max(20),
      districtId: z.string().max(30).nullable(),
    })
    .nullable(),
});
export const analysisSchema = z.strictObject({
  improvement: z.string().min(1),
  problem: z.string().min(1),
  next: z.string().min(1),
  factIds: z.array(z.string()),
  details: z.array(z.string()),
  alternative: z
    .strictObject({
      decisions: z.array(
        z.strictObject({
          measureId: z.string(),
          districtId: z.string().optional(),
        }),
      ),
      score: z.number(),
      scoreDelta: z.number(),
      spent: z.number(),
      criticalCount: z.number(),
    })
    .nullable(),
});
export type Analysis = z.infer<typeof analysisSchema>;
