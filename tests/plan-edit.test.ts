import { it, expect } from "vitest";
import { previewDecision } from "../lib/validate";
import { example } from "../data/example";
it("смена района в полном плане не добавляет шестую меру и не меняет стоимость", () => {
  const p = previewDecision(
    example,
    { measureId: "M7", districtId: "esil" },
    true,
  );
  expect(p.valid).toBe(true);
  expect(p.next).toHaveLength(5);
  expect(p.spent).toBe(95);
  expect(example[0].districtId).toBe("nura");
});
it("причина недостаточного бюджета содержит стоимость и остаток", () => {
  const p = previewDecision(
    [
      { measureId: "M3", districtId: "nura" },
      { measureId: "M13", districtId: "esil" },
      { measureId: "M7", districtId: "nura" },
    ],
    { measureId: "M8", districtId: "nura" },
  );
  expect(p.errors).toContain(
    "Нужно 20 ед., осталось 18. Уберите другое мероприятие.",
  );
});
it("смена района учитывает конфликт с существующей мерой", () => {
  const plan = [
    { measureId: "M4", districtId: "esil" },
    { measureId: "M7", districtId: "nura" },
  ];
  expect(
    previewDecision(plan, { measureId: "M4", districtId: "nura" }, true).valid,
  ).toBe(false);
  expect(
    previewDecision(plan, { measureId: "M4", districtId: "almaty" }, true)
      .valid,
  ).toBe(true);
});
it("шестая мера и дубликат блокируются с объяснением", () => {
  expect(
    previewDecision(example, { measureId: "M14" }).errors.join(),
  ).toContain("Удалите одно");
  expect(
    previewDecision(example.slice(0, 2), example[0]).errors.join(),
  ).toContain("уже в плане");
});
