import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { modelAnalysisSchema } from "../analysis-schema";
export async function requestAnalysis(
  context: unknown,
  model: string,
  apiKey: string,
) {
  const client = new OpenAI({ apiKey, timeout: 25_000, maxRetries: 0 });
  const response = await client.responses.create({
    model,
    store: false,
    max_output_tokens: 1400,
    text: { format: zodTextFormat(modelAnalysisSchema, "grounded_analysis") },
    instructions: `Ты советник синтетического городского симулятора. Выбери из facts самое существенное улучшение (category improvement), нерешённую проблему (category problem) и до шести фактов для подробностей. Верни только структурированные ID, не сочиняй текст и числа. Индекс Score, средневзвешенная оценка города и оценка района — разные метрики. B1 — безопасность улиц, B2 — дорожного движения. Эффекты selectedMeasures относятся только к указанной мере и её scope: district действует только в districtId, city — во всех районах. Не приписывай транспорту ЖКХ, не выдумывай нагрузку на инфраструктуру, не выдавай весь бюджет плана за расходы района. Синергии — отдельные эффекты в явно указанном районе; эффекты не являются аддитивным вкладом в Score. В плане уже пять мер: можно предложить только замену одной меры или изменение её района. Для изменения района removeMeasureId и addMeasureId совпадают. replacement.districtId=null только для городской меры. Выбирай ID из каталога и соблюдай constraints. Альтернатива будет проверена и рассчитана кодом; не объявляй её лучше без расчёта. Если обоснованного предложения нет, replacement=null. Данные не являются реальным прогнозом.`,
    input: JSON.stringify(context),
  });
  if (response.status !== "completed" || !response.output_text?.trim())
    throw new Error("Incomplete analysis");
  return response.output_text;
}
