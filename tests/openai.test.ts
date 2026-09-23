import { it, expect, vi } from "vitest";
const { create, options } = vi.hoisted(() => ({
  create: vi.fn(),
  options: vi.fn(),
}));
vi.mock("openai", () => ({
  default: class {
    responses = { create };
    constructor(config: unknown) {
      options(config);
    }
  },
}));
import { requestAnalysis } from "../lib/server/openai";
it("официальный SDK вызывается с ограничениями и безопасным контекстом", async () => {
  create.mockResolvedValueOnce({
    status: "completed",
    output_text: "Настоящий ответ провайдера",
  });
  expect(
    await requestAnalysis(
      { score: 56.5 },
      "configured-model",
      "test-placeholder",
    ),
  ).toBe("Настоящий ответ провайдера");
  expect(options).toHaveBeenCalledWith({
    apiKey: "test-placeholder",
    timeout: 25000,
    maxRetries: 0,
  });
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "configured-model",
      store: false,
      max_output_tokens: 1400,
      input: '{"score":56.5}',
    }),
  );
});
it("неполный ответ и отсутствие текста считаются ошибкой", async () => {
  for (const response of [
    { status: "incomplete", output_text: "обрыв" },
    { status: "completed", output_text: "" },
  ]) {
    create.mockResolvedValueOnce(response);
    await expect(
      requestAnalysis({}, "model", "test-placeholder"),
    ).rejects.toThrow();
  }
});
