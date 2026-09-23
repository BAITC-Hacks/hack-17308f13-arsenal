import { modelAnswer } from "./analysis-fixture";
import { it, expect, vi } from "vitest";
import { createAnalyzeHandler } from "../lib/server/analyze";
import { RequestLimits } from "../lib/server/request-limits";
import { example } from "../data/example";
const env = () => ({
  AI_ENABLED: "true",
  OPENAI_API_KEY: "test-placeholder",
  OPENAI_MODEL: "test-model",
});
const req = (body: unknown = { decisions: example }) =>
  new Request("http://localhost/api/analyze", {
    method: "POST",
    body: JSON.stringify(body),
  });
it("выключенный AI и неправильная конфигурация не вызывают провайдера", async () => {
  const p = vi.fn();
  expect(
    (await createAnalyzeHandler(p, new RequestLimits(), () => ({}))(req()))
      .status,
  ).toBe(503);
  expect(
    (
      await createAnalyzeHandler(p, new RequestLimits(), () => ({
        AI_ENABLED: "true",
      }))(req())
    ).status,
  ).toBe(503);
  expect(p).not.toHaveBeenCalled();
});
it("невалидные запросы не вызывают OpenAI", async () => {
  const p = vi.fn(),
    h = createAnalyzeHandler(p, new RequestLimits(), env);
  for (const body of [
    { decisions: [] },
    { decisions: example, score: 100 },
    { decisions: [{ measureId: "bad" }] },
    { decisions: example.map((d) => ({ ...d, system: "injected" })) },
  ])
    expect((await h(req(body))).status).toBe(400);
  expect(p).not.toHaveBeenCalled();
});
it("размер, JSON, поток без content-length", async () => {
  const p = vi.fn(),
    h = createAnalyzeHandler(p, new RequestLimits(), env);
  expect((await h(req("x".repeat(9000)))).status).toBe(413);
  expect(
    (await h(new Request("http://localhost", { method: "POST", body: "{" })))
      .status,
  ).toBe(400);
  expect(p).not.toHaveBeenCalled();
});
it("ошибки провайдера не раскрывают секреты, можно повторить", async () => {
  const p = vi
    .fn()
    .mockRejectedValueOnce(
      new Error("test-placeholder Authorization private-provider-error"),
    )
    .mockResolvedValueOnce(modelAnswer);
  const h = createAnalyzeHandler(p, new RequestLimits(), env),
    r = await h(req());
  expect(r.status).toBe(502);
  const text = await r.text();
  for (const value of [
    "test-placeholder",
    "Authorization",
    "private-provider-error",
  ])
    expect(text).not.toContain(value);
  expect((await h(req())).status).toBe(200);
});
it("сервер пересчитывает, кэш нормализует порядок и учитывает модель", async () => {
  const p = vi.fn().mockResolvedValue(modelAnswer),
    config = env(),
    h = createAnalyzeHandler(p, new RequestLimits(), () => config);
  const a = await (await h(req())).json(),
    b = await (await h(req({ decisions: [...example].reverse() }))).json();
  expect(a.scenarioId).toBe(b.scenarioId);
  expect(b.cached).toBe(true);
  expect(p).toHaveBeenCalledTimes(1);
  expect(p.mock.calls[0][0].finalScore).toBeCloseTo(56.54307, 8);
  expect(JSON.stringify(p.mock.calls[0][0])).not.toContain("test-placeholder");
  config.OPENAI_MODEL = "other";
  await h(req());
  expect(p).toHaveBeenCalledTimes(2);
});
it("частота, параллельность и TTL", () => {
  let time = 0;
  const l = new RequestLimits(() => time);
  expect(l.acquire()).toBe(true);
  expect(l.acquire()).toBe(true);
  expect(l.acquire()).toBe(false);
  l.release();
  l.release();
  for (let i = 0; i < 4; i++) {
    expect(l.acquire()).toBe(true);
    l.release();
  }
  expect(l.acquire()).toBe(false);
  time = 60_001;
  expect(l.acquire()).toBe(true);
  l.release();
  l.set("a", "text");
  expect(l.get("a")).toBe("text");
  time += 600_001;
  expect(l.get("a")).toBeUndefined();
  for (let i = 0; i < 101; i++) l.set(String(i), "text");
  expect(l.get("0")).toBeUndefined();
});
it("API возвращает 429 при двух активных запросах", async () => {
  let resolve!: (s: string) => void;
  const p = vi.fn(
    () =>
      new Promise<string>((r) => {
        resolve = r;
      }),
  );
  const limits = new RequestLimits();
  limits.acquire();
  const h = createAnalyzeHandler(p, limits, env);
  const pending = h(req());
  await vi.waitFor(() => expect(p).toHaveBeenCalledTimes(1));
  expect((await h(req())).status).toBe(429);
  resolve(modelAnswer);
  expect((await pending).status).toBe(200);
  limits.release();
});

it("невалидный ответ модели не кэшируется и не раскрывает его содержание", async () => {
  const p = vi
    .fn()
    .mockResolvedValueOnce(
      JSON.stringify({
        ...JSON.parse(modelAnswer),
        detailFactIds: ["fabricated-private-fact"],
      }),
    )
    .mockResolvedValueOnce(modelAnswer);
  const h = createAnalyzeHandler(p, new RequestLimits(), env),
    bad = await h(req());
  expect(bad.status).toBe(502);
  expect(await bad.text()).not.toContain("fabricated");
  const good = await h(req());
  expect(good.status).toBe(200);
  expect(p).toHaveBeenCalledTimes(2);
});
it("старый кэш не используется после смены версии AI-контракта", async () => {
  const { DATA_VERSION } = await import("../data/rules");
  const { scenarioId } = await import("../lib/scenario-schema");
  const guard = new RequestLimits();
  guard.set(
    JSON.stringify([DATA_VERSION, env().OPENAI_MODEL, scenarioId(example)]),
    "старый ошибочный разбор",
  );
  const p = vi.fn().mockResolvedValue(modelAnswer);
  const response = await (
    await createAnalyzeHandler(p, guard, env)(req())
  ).json();
  expect(p).toHaveBeenCalledOnce();
  expect(response.cached).toBe(false);
  expect(response.analysis.improvement).toContain("Индекс качества жизни");
});
