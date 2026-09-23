import "server-only";
import { scenarioSchema } from "../scenario-schema";
import { validateScenario } from "../validate";
import { simulateScenario } from "../simulate";
import { DATA_VERSION, labels } from "../../data/rules";
import { requestAnalysis } from "./openai";
import { limits, readBody, RequestLimits } from "./request-limits";
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export function createAnalyzeHandler(
  provider = requestAnalysis,
  guard: RequestLimits = limits,
  env: () => {
    AI_ENABLED?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
  } = () => ({
    AI_ENABLED: process.env.AI_ENABLED,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  }),
) {
  return async (request: Request) => {
    const config = env();
    if (config.AI_ENABLED !== "true")
      return reply(
        {
          code: "AI_DISABLED",
          error: "AI-анализ выключен. Симулятор доступен без AI.",
        },
        503,
      );
    if (!config.OPENAI_API_KEY?.trim() || !config.OPENAI_MODEL?.trim())
      return reply(
        {
          code: "AI_NOT_CONFIGURED",
          error: "Для AI настройте OPENAI_API_KEY и OPENAI_MODEL на сервере.",
        },
        503,
      );
    let body: unknown;
    try {
      body = await readBody(request);
    } catch (e) {
      return reply(
        {
          error:
            e instanceof Error && e.message === "size"
              ? "Тело запроса превышает 8 КБ."
              : "Некорректный JSON.",
        },
        e instanceof Error && e.message === "size" ? 413 : 400,
      );
    }
    const parsed = scenarioSchema.safeParse(body);
    if (!parsed.success)
      return reply(
        {
          error:
            "Неверная схема запроса: разрешён только список решений с известными ID.",
        },
        400,
      );
    const validation = validateScenario(parsed.data.decisions);
    if (!validation.valid)
      return reply({ error: validation.errors.join(" ") }, 400);
    const result = simulateScenario(parsed.data.decisions),
      key = JSON.stringify([
        DATA_VERSION,
        config.OPENAI_MODEL,
        result.scenarioId,
      ]);
    const cached = guard.get(key);
    if (cached)
      return reply({
        analysis: cached,
        scenarioId: result.scenarioId,
        cached: true,
      });
    if (!guard.acquire())
      return reply(
        { error: "Лимит AI-запросов достигнут. Повторите через минуту." },
        429,
      );
    try {
      const analysis = await provider(
        { dataVersion: DATA_VERSION, indicatorNames: labels, ...result },
        config.OPENAI_MODEL,
        config.OPENAI_API_KEY,
      );
      guard.set(key, analysis);
      return reply({ analysis, scenarioId: result.scenarioId, cached: false });
    } catch {
      return reply(
        {
          error: "Сервис AI не смог завершить анализ. Повторите запрос позже.",
        },
        502,
      );
    } finally {
      guard.release();
    }
  };
}
