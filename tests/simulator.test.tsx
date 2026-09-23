// @vitest-environment jsdom
import { analysisFixture } from "./analysis-fixture";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import Simulator from "../components/Simulator";
import { example } from "../data/example";
import { scenarioId } from "../lib/scenario-schema";
let root: Root, host: HTMLDivElement;
const fetcher = vi.fn();
function buttons(text: string, scope: ParentNode = host) {
  return Array.from(scope.querySelectorAll<HTMLButtonElement>("button")).filter(
    (b) => b.textContent?.trim() === text,
  );
}
function button(text: string, scope: ParentNode = host) {
  const b = buttons(text, scope)[0];
  if (!b) throw new Error("Button missing: " + text);
  return b;
}
async function click(b: HTMLElement) {
  await act(async () => {
    b.focus();
    b.click();
  });
}
const text = () => host.textContent ?? "";
async function exampleReview() {
  await click(button("Попробовать готовый план"));
  await click(button("Проверить план →"));
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
  fetcher.mockImplementation(() =>
    Promise.resolve(Response.json({ code: "AI_DISABLED" }, { status: 503 })),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  HTMLElement.prototype.scrollIntoView = vi.fn();
  // jsdom has no native dialog focus/visual behavior. Test component lifecycle and explicit keyboard handling.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Simulator />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("три шага, результат сразу, возврат без потери плана и без повторного AI-запроса", async () => {
  expect(text()).toContain("Составьте план развития города");
  expect(text()).not.toContain("Результат вашего плана");
  expect(button("Проверить план →").disabled).toBe(true);
  await exampleReview();
  expect(text()).toContain("Проверьте свой план");
  expect(text()).not.toContain("Выберите мероприятия");
  expect(document.activeElement?.textContent).toBe("Проверьте свой план");
  await click(button("Посмотреть результат"));
  expect(text()).toContain("Результат вашего плана");
  expect(text()).toContain("56,54");
  expect(text()).toContain("AI-разбор сейчас недоступен");
  expect(document.activeElement?.textContent).toBe("Результат вашего плана");
  expect(fetcher).toHaveBeenCalledTimes(1);
  await click(button("Изменить план"));
  expect(text()).toContain("Мероприятия: 5 из 5");
  await click(button("Проверить план →"));
  await click(button("Посмотреть результат"));
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("изменение плана удаляет результат; запоздавший AI не появляется", async () => {
  let finish!: (r: Response) => void;
  fetcher.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  await exampleReview();
  await click(button("Посмотреть результат"));
  expect(text()).toContain("Анализируем ваш план…");
  expect(text()).toContain("56,54");
  await click(button("Изменить план"));
  await click(
    host.querySelector<HTMLButtonElement>(
      'button[aria-label="Удалить: Школа и детсад"]',
    )!,
  );
  await act(async () =>
    finish(
      Response.json({
        scenarioId: scenarioId(example),
        analysis: analysisFixture("Устаревший ответ"),
      }),
    ),
  );
  expect(text()).not.toContain("Устаревший ответ");
  expect(button("Проверить план →").disabled).toBe(true);
  expect(host.querySelectorAll(".steps button")[2]).toHaveProperty(
    "disabled",
    true,
  );
});
it("ошибка не раскрывает API-детали, повтор показывает безопасный текст успеха", async () => {
  fetcher.mockResolvedValueOnce(
    Response.json({ error: "private stack trace" }, { status: 502 }),
  );
  await exampleReview();
  await click(button("Посмотреть результат"));
  expect(text()).toContain(
    "Не удалось получить AI-разбор. Результаты расчёта доступны",
  );
  expect(text()).not.toContain("private stack");
  fetcher.mockResolvedValueOnce(
    Response.json({
      scenarioId: scenarioId(example),
      analysis: analysisFixture(
        "Сильные стороны\n\nТестовый разбор <script>unsafe</script>",
      ),
    }),
  );
  await click(button("Повторить анализ"));
  expect(text()).toContain("Тестовый разбор");
  expect(host.querySelector("script")).toBeNull();
});

it("панель полного плана и границы клавиатурного фокуса диалога", async () => {
  await click(button("Попробовать готовый план"));
  await click(button("Ваш план · 5 из 5 ↑"));
  const modal = host.querySelector("dialog")!;
  expect(modal.textContent).toContain("Бюджет плана: 95 из 100");
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    { width: 1, height: 1 },
  ] as unknown as DOMRectList);
  const first = modal.querySelector<HTMLButtonElement>("button")!,
    last = Array.from(modal.querySelectorAll<HTMLButtonElement>("button")).at(
      -1,
    )!;
  await act(async () => {
    last.focus();
    last.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  expect(document.activeElement).toBe(first);
  await act(async () => {
    first.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  expect(document.activeElement).toBe(last);
  await click(button("Проверить план →", modal));
  expect(host.querySelector("dialog")).toBeNull();
  expect(document.activeElement?.textContent).toBe("Проверьте свой план");
});

it("все пять географических областей доступны с клавиатуры и синхронизированы со списком", async () => {
  const select = host.querySelector<HTMLSelectElement>("#district-context")!;
  const regions = Array.from(
    host.querySelectorAll<SVGGElement>(".geographic-map .map-region"),
  );
  expect(regions).toHaveLength(5);
  for (const [i, id] of [
    "esil",
    "almaty",
    "saryarka",
    "baikonur",
    "nura",
  ].entries()) {
    await act(async () => {
      regions[i].dispatchEvent(
        new KeyboardEvent("keydown", {
          key: i % 2 ? " " : "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(select.value).toBe(id);
    expect(regions[i].getAttribute("aria-pressed")).toBe("true");
    expect(
      host.querySelectorAll('.map-region[aria-pressed="true"]'),
    ).toHaveLength(1);
    await act(async () => {
      select.value = "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(regions[i].getAttribute("aria-pressed")).toBe("false");
  }
  expect(host.querySelectorAll(".geographic-map")).toHaveLength(1);
  expect(
    host.querySelector(".geographic-map")?.getAttribute("preserveAspectRatio"),
  ).toBe("xMidYMid meet");
  expect(host.querySelectorAll(".district-shape")).toHaveLength(5);
  expect(host.querySelector(".map-river")?.getAttribute("d")).toMatch(/^M/);
  expect(host.querySelector(".district-map figcaption")?.textContent).toContain(
    "Схематичные границы",
  );
  expect(host.querySelector(".district-map figcaption")?.textContent).toContain(
    "CC BY-SA 4.0",
  );
});

async function selectDistrict(id: string) {
  const select = host.querySelector<HTMLSelectElement>("#district-context")!;
  await act(async () => {
    select.value = id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
function card(id: string) {
  return host.querySelector(`article[aria-labelledby="measure-${id}"]`)!;
}
async function add(id: string) {
  const b = card(id).querySelector<HTMLButtonElement>(".card-action button")!;
  await click(b);
}
it("район выбирается один раз: прямое добавление, независимые районы и городская мера", async () => {
  await selectDistrict("nura");
  await add("M7");
  expect(host.querySelector("dialog")).toBeNull();
  expect(card("M7").textContent).toContain("В плане · Нура");
  await selectDistrict("saryarka");
  await add("M5");
  expect(card("M7").textContent).toContain("В плане · Нура");
  expect(card("M5").textContent).toContain("В плане · Сарыарка");
  await add("M12");
  expect(card("M12").textContent).toContain("В плане · Весь город");
  expect(host.querySelector("dialog")).toBeNull();
  expect(text()).toContain("Мероприятия: 3 из 5");
  await add("M7");
  expect(text()).toContain("Мероприятия: 3 из 5");
  await selectDistrict("nura");
  await add("M8");
  await add("M10");
  await click(button("Проверить план →"));
  await click(button("Посмотреть результат"));
  expect(text()).toContain("56,54");
  const submitted = JSON.parse(fetcher.mock.calls[0][1].body).decisions;
  expect(
    submitted.find((d: { measureId: string }) => d.measureId === "M12"),
  ).toEqual({ measureId: "M12" });
  expect(
    submitted.find((d: { measureId: string }) => d.measureId === "M7")
      .districtId,
  ).toBe("nura");
});
it("без района кнопка переводит фокус к единственному dropdown без автоматического выбора", async () => {
  await click(button("Выбрать район", card("M7")));
  expect(document.activeElement).toBe(host.querySelector("#district-context"));
  expect(host.querySelector("#district-context")).toHaveProperty("value", "");
  expect(host.querySelectorAll("select")).toHaveLength(1);
  expect(host.querySelector("dialog")).toBeNull();
  expect(text()).toContain("Выберите район, затем добавьте мероприятие");
  expect(text()).toContain("Мероприятия: 0 из 5");
});
it("конфликт показывается на карточке; другой район разрешает добавление", async () => {
  await selectDistrict("nura");
  await add("M7");
  expect(button("Добавить в план", card("M4")).disabled).toBe(true);
  expect(card("M4").textContent).toContain("несовместимы");
  expect(card("M4").textContent).toContain("Выберите другой район");
  expect(host.querySelector("dialog")).toBeNull();
  await selectDistrict("esil");
  await add("M4");
  expect(card("M4").textContent).toContain("В плане · Есиль");
});
it("направление, бюджет, шестая мера и двойной клик проверяются на актуальном плане", async () => {
  await selectDistrict("nura");
  const first = button("Добавить в план", card("M7"));
  await act(async () => {
    first.click();
    first.click();
  });
  expect(text()).toContain("Мероприятия: 1 из 5");
  await add("M8");
  expect(button("Добавить в план", card("M9")).disabled).toBe(true);
  expect(card("M9").textContent).toContain("уже выбраны 2 мероприятия");
  await add("M3");
  await add("M14");
  expect(card("M13").textContent).toContain(
    "Не хватает бюджета: нужно 28 ед., осталось 10",
  );
  expect(button("Добавить в план", card("M13")).disabled).toBe(true);
  await add("M11");
  expect(card("M10").textContent).not.toContain("Выбраны все 5");
  expect(host.querySelectorAll(".catalog-complete")).toHaveLength(1);
  expect(host.querySelector(".catalog-complete")?.textContent).toContain(
    "Выбраны все 5 мероприятий",
  );
});
it("редактирование района компактно, Escape восстанавливает фокус; текущий район не зависит от карты", async () => {
  await click(button("Попробовать готовый план"));
  await selectDistrict("saryarka");
  const edit = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Изменить район: Школа и детсад"]',
  )!;
  await click(edit);
  let modal = host.querySelector("dialog")!;
  expect(modal.querySelectorAll('input[type="radio"]')).toHaveLength(5);
  expect(modal.querySelector('input[value="nura"]')).toHaveProperty(
    "checked",
    true,
  );
  expect(modal.textContent).not.toContain("/100");
  await act(async () =>
    modal.dispatchEvent(new Event("cancel", { cancelable: true })),
  );
  expect(document.activeElement).toBe(edit);
  await click(edit);
  modal = host.querySelector("dialog")!;
  await click(modal.querySelector('input[value="esil"]')!);
  await click(button("Сохранить", modal));
  expect(card("M7").textContent).toContain("В плане · Есиль");
  expect(text()).toContain("Бюджет плана: 95 из 100");
  expect(host.querySelector("#district-context")).toHaveProperty(
    "value",
    "saryarka",
  );
});
it("изменение района учитывает несовместимость, сброс требует подтверждения", async () => {
  await selectDistrict("nura");
  await add("M7");
  await selectDistrict("esil");
  await add("M4");
  await click(
    host.querySelector<HTMLButtonElement>(
      'button[aria-label="Изменить район: Парк / сквер"]',
    )!,
  );
  const modal = host.querySelector("dialog")!;
  expect(modal.querySelector('input[value="nura"]')).toHaveProperty(
    "disabled",
    true,
  );
  expect(modal.textContent).toContain("несовместимы");
  await click(
    modal.querySelector<HTMLButtonElement>(
      'button[aria-label="Закрыть окно"]',
    )!,
  );
  await click(button("Сбросить план"));
  await click(button("Отмена"));
  expect(text()).toContain("Мероприятия: 2 из 5");
  await click(button("Сбросить план"));
  await click(button("Сбросить"));
  expect(text()).toContain("Мероприятия: 0 из 5");
});

it("кнопка продолжения вне прокручиваемого списка, одно сообщение о полном плане", async () => {
  await click(button("Попробовать готовый план"));
  const panel = host.querySelector(".desktop-plan")!,
    scroll = panel.querySelector(".plan-scroll")!;
  expect(scroll.getAttribute("tabindex")).toBe("0");
  expect(scroll.querySelectorAll(".plan-list li")).toHaveLength(5);
  const proceed = button("Проверить план →", panel);
  expect(scroll.contains(proceed)).toBe(false);
  expect(panel.querySelector(".plan-footer")?.contains(proceed)).toBe(true);
  expect(proceed.disabled).toBe(false);
  expect(panel.querySelector(".plan-footer")?.textContent).toContain(
    "План собран — можно продолжить",
  );
  expect(host.querySelectorAll(".catalog-complete")).toHaveLength(1);
  expect(host.querySelector(".catalog")?.textContent).not.toContain(
    "Выбраны все 5 мероприятий",
  );
});
it("краткий AI перед таблицей, подробности раскрываются без второго запроса", async () => {
  fetcher.mockResolvedValueOnce(
    Response.json({
      scenarioId: scenarioId(example),
      analysis: analysisFixture(),
    }),
  );
  await exampleReview();
  await click(button("Посмотреть результат"));
  const advisor = host.querySelector(".advisor")!,
    table = host.querySelector(".district-results")!;
  expect(
    advisor.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  for (const title of [
    "Главное улучшение",
    "Что осталось проблемой",
    "Что можно изменить",
  ])
    expect(advisor.textContent).toContain(title);
  const details = advisor.querySelector("details")!;
  expect(details.open).toBe(false);
  await click(details.querySelector("summary")!);
  expect(details.open).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(host.querySelector(".result-hero h2")?.textContent).toBe(
    "Индекс качества жизни",
  );
});
