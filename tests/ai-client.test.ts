import { it, expect, vi } from "vitest";
import { AnalysisRequest, type AiState } from "../lib/ai-client";
import { example } from "../data/example";
import { scenarioId } from "../lib/scenario-schema";
const id = scenarioId(example);
const response = (body: unknown, status = 200) =>
  Response.json(body, { status });
it("один запрос при повторном расчёте/возврате, повтор только явно", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      response({ scenarioId: id, analysis: "Сильные стороны: текст" }),
    );
  const publish = vi.fn();
  const client = new AnalysisRequest(publish, fetcher);
  const first = client.run(example, id);
  await client.run(example, id);
  await first;
  await client.run(example, id);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenLastCalledWith({
    status: "success",
    scenarioId: id,
    text: "Сильные стороны: текст",
  });
  fetcher.mockResolvedValue(
    response({ scenarioId: id, analysis: "Новый текст" }),
  );
  await client.run(example, id, true);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("поздний ответ старого плана не заменяет новый, даже если транспорт игнорирует abort", async () => {
  let finish!: (response: Response) => void;
  const transport = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(
      response({ scenarioId: "new", analysis: "Новый план" }),
    );
  const states: AiState[] = [];
  const client = new AnalysisRequest((s) => states.push(s), transport);
  const old = client.run(example, id);
  client.invalidate();
  await client.run(example, "new");
  finish(response({ scenarioId: id, analysis: "Старый план" }));
  await old;
  expect(states.at(-1)).toEqual({
    status: "success",
    scenarioId: "new",
    text: "Новый план",
  });
  expect(states.some((s) => s.text === "Старый план")).toBe(false);
  expect(transport.mock.calls[0][1].signal.aborted).toBe(true);
});
it.each(["AI_DISABLED", "AI_NOT_CONFIGURED"])(
  "недоступный AI: %s",
  async (code) => {
    const publish = vi.fn();
    await new AnalysisRequest(
      publish,
      vi
        .fn()
        .mockResolvedValue(response({ code, error: "внутренний текст" }, 503)),
    ).run(example, id);
    expect(publish).toHaveBeenLastCalledWith({
      status: "disabled",
      scenarioId: id,
    });
  },
);
it("ошибки, чужой сценарий и неверный JSON не раскрывают внутренний текст", async () => {
  for (const r of [
    response({ error: "stack trace secret" }, 502),
    response({ scenarioId: "other", analysis: "incorrect" }),
    new Response("not json"),
  ]) {
    const publish = vi.fn();
    await new AnalysisRequest(publish, vi.fn().mockResolvedValue(r)).run(
      example,
      id,
    );
    expect(publish).toHaveBeenLastCalledWith({
      status: "error",
      scenarioId: id,
    });
    expect(JSON.stringify(publish.mock.calls)).not.toContain("secret");
  }
});
