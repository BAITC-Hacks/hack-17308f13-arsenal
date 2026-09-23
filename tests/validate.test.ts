import { it, expect } from "vitest";
import { validateScenario } from "../lib/validate";
import { example } from "../data/example";
import { scenarioSchema } from "../lib/scenario-schema";
const pick = (ids: string[], districtId = "nura") =>
  ids.map((measureId) => ({
    measureId,
    ...(["M2", "M6", "M12", "M14"].includes(measureId) ? {} : { districtId }),
  }));
it("ровно 100 разрешено, превышение запрещено", () => {
  expect(validateScenario(pick(["M3", "M7", "M10", "M12", "M8"])).valid).toBe(
    true,
  );
  expect(validateScenario(pick(["M3", "M7", "M10", "M12", "M13"])).valid).toBe(
    false,
  );
});
it.each([0, 1, 2, 3, 4, 6])("число решений %s запрещено", (n) =>
  expect(
    validateScenario(Array.from({ length: n }, () => example[0])).valid,
  ).toBe(false),
);
it("повторы", () =>
  expect(
    validateScenario([...example.slice(0, 4), example[0]]).errors.join(),
  ).toContain("повтор"));
it("не более двух мер направления", () =>
  expect(
    validateScenario(pick(["M7", "M8", "M9", "M12", "M10"])).errors.join(),
  ).toContain("максимум"));
it.each([
  ["M1", "M3"],
  ["M4", "M7"],
  ["M5", "M13"],
])("конфликт %s %s", (a, b) =>
  expect(
    validateScenario(pick([a, b, "M9", "M10", "M12"])).errors.join(),
  ).toContain("несовместимы"),
);
it("M1 M3 конфликтуют даже в разных районах", () => {
  const d = pick(["M1", "M3", "M9", "M10", "M12"]);
  d[0].districtId = "esil";
  expect(validateScenario(d).errors.join()).toContain("несовместимы");
});
it.each([
  ["M4", "M7"],
  ["M5", "M13"],
])("%s %s в разных районах допустимы", (a, b) => {
  const d = pick([a, b, "M9", "M10", "M12"]);
  d[0].districtId = "esil";
  expect(validateScenario(d).valid).toBe(true);
});
it("неизвестные ID и типы", () => {
  for (const d of [
    [{ measureId: "bad" }],
    [{ measureId: "M7", districtId: "bad" }],
    null,
    "text",
    [{ measureId: 7 }],
  ])
    expect(validateScenario(d).valid).toBe(false);
});
it("район обязателен и запрещён для городских", () => {
  expect(
    validateScenario(
      example.map((d) => (d.measureId === "M7" ? { measureId: "M7" } : d)),
    ).valid,
  ).toBe(false);
  expect(
    validateScenario(
      example.map((d) =>
        d.measureId === "M12" ? { ...d, districtId: "nura" } : d,
      ),
    ).valid,
  ).toBe(false);
});
it("строгая схема отклоняет дополнительные поля", () => {
  expect(
    scenarioSchema.safeParse({ decisions: example, score: 100 }).success,
  ).toBe(false);
  expect(
    scenarioSchema.safeParse({ decisions: [{ ...example[0], price: 1 }] })
      .success,
  ).toBe(false);
});

it("неполный план допустим только при сборке; все другие ограничения сохраняются", () => {
  expect(validateScenario([], { partial: true }).valid).toBe(true);
  expect(validateScenario(example.slice(0, 3), { partial: true }).valid).toBe(
    true,
  );
  expect(validateScenario(example.slice(0, 3)).valid).toBe(false);
  for (const input of [
    pick(["M1", "M3"]),
    pick(["M4", "M7"]),
    pick(["M5", "M13"]),
    pick(["M7", "M8", "M9"]),
    [example[0], example[0]],
    [{ measureId: "M7" }],
  ])
    expect(validateScenario(input, { partial: true }).valid).toBe(false);
});
