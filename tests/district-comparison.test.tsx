// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import DistrictComparison from "../components/DistrictComparison";
import { simulateScenario } from "../lib/simulate";
import { example } from "../data/example";
import { format } from "../lib/format";

it("пять районов, общая шкала, точная таблица и обновление результата", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"),
    root = createRoot(host);
  try {
    for (const plan of [
      example,
      [
        { measureId: "M1", districtId: "saryarka" },
        { measureId: "M2" },
        { measureId: "M4", districtId: "saryarka" },
        { measureId: "M8", districtId: "saryarka" },
        { measureId: "M14" },
      ],
    ]) {
      const result = simulateScenario(plan);
      await act(async () =>
        root.render(<DistrictComparison result={result} />),
      );
      const rows = [...host.querySelectorAll(".district-comparison > li")];
      expect(rows.map((r) => r.querySelector("strong")!.textContent)).toEqual([
        "Есиль",
        "Алматы",
        "Сарыарка",
        "Байконур",
        "Нура",
      ]);
      rows.forEach((row, i) => {
        const values = [...row.querySelectorAll(".comparison-value")].map(
          (v) => v.textContent,
        );
        expect(values).toEqual([
          format(result.before.districts[i].score),
          format(result.after.districts[i].score),
        ]);
        const cells = host
          .querySelectorAll("tbody tr")
          [i].querySelectorAll("td");
        expect([cells[0].textContent, cells[1].textContent]).toEqual(values);
        expect(cells[2].textContent).toBe(
          row.querySelector(".comparison-delta")!.textContent,
        );
        expect(
          row.querySelector<HTMLElement>(".comparison-fill.comparison-after")!
            .style.width,
        ).toBe(`${result.after.districts[i].score}%`);
      });
    }
    const details = host.querySelector("details")!;
    expect(details.open).toBe(false);
    details.querySelector("summary")!.click();
    expect(details.open).toBe(true);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
