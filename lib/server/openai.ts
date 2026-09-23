import "server-only";
import OpenAI from "openai";
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
    instructions:
      "Ты советник пользователя городского симулятора. Объясняй только переданный расчёт. Данные синтетические, выводы относятся к этой модели. Не придумывай числа, мероприятия, синергии или реальные прогнозы. Объясни результат, сильные стороны, нерешённые проблемы, отрицательные эффекты и компромиссы. Если рекомендуешь замену, предложи проверить её симулятором. Не обещай численный прирост альтернативы без готового расчёта. Пиши по-русски, кратко и конкретно. Используй четыре раздела: Сильные стороны; Оставшиеся проблемы; Компромиссы; Рекомендации.",
    input: JSON.stringify(context),
  });
  if (response.status !== "completed" || !response.output_text?.trim())
    throw new Error("Incomplete analysis");
  return response.output_text;
}
