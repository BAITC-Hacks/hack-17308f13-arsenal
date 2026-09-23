// @vitest-environment jsdom
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
  await click(button("Загрузить пример"));
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
  expect(text()).toContain("Какие изменения нужны городу?");
  expect(text()).not.toContain("Результат вашего плана");
  expect(button("Проверить план →").disabled).toBe(true);
  await exampleReview();
  expect(text()).toContain("Всё готово к расчёту");
  expect(text()).not.toContain("Мероприятия для вашего плана");
  expect(document.activeElement?.textContent).toBe("Всё готово к расчёту");
  await click(button("Рассчитать результат →"));
  expect(text()).toContain("Результат вашего плана");
  expect(text()).toContain("56,54");
  expect(text()).toContain("AI-разбор сейчас недоступен");
  expect(document.activeElement?.textContent).toBe("Результат вашего плана");
  expect(fetcher).toHaveBeenCalledTimes(1);
  await click(button("Изменить план"));
  expect(text()).toContain("Выбрано 5 из 5");
  await click(button("Проверить план →"));
  await click(button("Рассчитать результат →"));
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("диалог выбора района: критические значения, добавление и редактирование полного плана", async () => {
  const school = host.querySelector('article[aria-labelledby="measure-M7"]')!;
  await click(button("Выбрать район", school));
  let modal = host.querySelector("dialog")!;
  expect(modal.textContent).toContain("38/100");
  expect(modal.textContent).toContain("Критическое значение");
  expect(button("Добавить в план", modal).disabled).toBe(true);
  await click(modal.querySelector<HTMLInputElement>('input[value="nura"]')!);
  await click(button("Добавить в план", modal));
  expect(host.querySelector("dialog")).toBeNull();
  expect(document.activeElement?.textContent).toBe("✓ В плане");
  await click(button("Загрузить пример"));
  await click(button("Загрузить пример", host.querySelector("dialog")!));
  await click(
    host.querySelector<HTMLButtonElement>(
      'button[aria-label="Изменить район: Школа и детсад"]',
    )!,
  );
  modal = host.querySelector("dialog")!;
  await click(modal.querySelector<HTMLInputElement>('input[value="esil"]')!);
  await click(button("Сохранить район", modal));
  expect(button("Проверить план →").disabled).toBe(false);
  expect(text()).toContain("Использовано 95 из 100");
});
it("Escape/cancel закрывает окно и восстанавливает фокус; сброс требует подтверждения", async () => {
  const source = button("Выбрать район");
  await click(source);
  await act(async () => {
    host
      .querySelector("dialog")!
      .dispatchEvent(new Event("cancel", { cancelable: true }));
  });
  expect(host.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(source);
  await exampleReview();
  await click(button("Рассчитать результат →"));
  await click(button("Начать заново"));
  await click(button("Сохранить текущий план"));
  expect(text()).toContain("56,54");
  await click(button("Начать заново"));
  await click(button("Да, начать заново"));
  expect(text()).toContain("Выбрано 0 из 5");
  expect(text()).not.toContain("56,54");
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
  await click(button("Рассчитать результат →"));
  expect(text()).toContain("Готовим объяснение вашего плана…");
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
        analysis: "Устаревший ответ",
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
  await click(button("Рассчитать результат →"));
  expect(text()).toContain("Не удалось загрузить AI-разбор. Расчёт готов");
  expect(text()).not.toContain("private stack");
  fetcher.mockResolvedValueOnce(
    Response.json({
      scenarioId: scenarioId(example),
      analysis: "Сильные стороны\n\nТестовый разбор <script>unsafe</script>",
    }),
  );
  await click(button("Повторить"));
  expect(text()).toContain("Тестовый разбор");
  expect(host.querySelector("script")).toBeNull();
});

it("несовместимый район запрещён в диалоге, другие районы доступны", async () => {
  const park = host.querySelector('article[aria-labelledby="measure-M4"]')!;
  await click(button("Выбрать район", park));
  await click(host.querySelector('dialog input[value="nura"]')!);
  await click(button("Добавить в план", host.querySelector("dialog")!));
  const school = host.querySelector('article[aria-labelledby="measure-M7"]')!;
  await click(button("Выбрать район", school));
  const modal = host.querySelector("dialog")!;
  expect(modal.querySelector('input[value="nura"]')).toHaveProperty(
    "disabled",
    true,
  );
  expect(modal.textContent).toContain("несовместимы в одном районе");
  expect(modal.querySelector('input[value="esil"]')).toHaveProperty(
    "disabled",
    false,
  );
});
it("ограничения направления, бюджета и шестой меры объясняются рядом с действием", async () => {
  async function add(id: string) {
    const card = host.querySelector(
      `article[aria-labelledby="measure-${id}"]`,
    )!;
    const district = buttons("Выбрать район", card)[0];
    if (district) {
      await click(district);
      await click(host.querySelector('dialog input[value="nura"]')!);
      await click(button("Добавить в план", host.querySelector("dialog")!));
    } else await click(button("Добавить в план", card));
  }
  await add("M7");
  await add("M8");
  const third = host.querySelector('article[aria-labelledby="measure-M9"]')!;
  expect(button("Выбрать район", third).disabled).toBe(true);
  expect(third.textContent).toContain("уже выбраны 2 меры");
  await add("M3");
  await add("M14");
  const expensive = host.querySelector(
    'article[aria-labelledby="measure-M13"]',
  )!;
  expect(expensive.textContent).toContain("Нужно 28 ед., осталось 10");
  expect(button("Выбрать район", expensive).disabled).toBe(true);
  await add("M11");
  const sixth = host.querySelector('article[aria-labelledby="measure-M10"]')!;
  expect(sixth.textContent).toContain("Выбраны все 5 мероприятий");
  expect(button("Выбрать район", sixth).disabled).toBe(true);
});
it("панель полного плана и границы клавиатурного фокуса диалога", async () => {
  await click(button("Загрузить пример"));
  await click(button("Ваш план · 5 из 5 ↑"));
  const modal = host.querySelector("dialog")!;
  expect(modal.textContent).toContain("Использовано 95 из 100");
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
  expect(document.activeElement?.textContent).toBe("Всё готово к расчёту");
});

it("схема и переключатель синхронны; район подставляется только в новую районную меру", async () => {
  const select = host.querySelector<HTMLSelectElement>("#district-context")!;
  await act(async () => {
    select.value = "nura";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(
    host
      .querySelector('.map-desktop g[aria-label^="Нура"]')
      ?.getAttribute("aria-pressed"),
  ).toBe("true");
  expect(host.querySelector(".catalog-context")?.textContent).toContain(
    "Район: Нура",
  );
  const school = host.querySelector('article[aria-labelledby="measure-M7"]')!;
  await click(button("Выбрать район", school));
  const modal = host.querySelector("dialog")!;
  expect(modal.querySelector('input[value="nura"]')).toHaveProperty(
    "checked",
    true,
  );
  expect(text()).toContain("Выбрано 0 из 5");
  await click(button("Добавить в план", modal));
  expect(text()).toContain("Выбрано 1 из 5");
  await act(async () => {
    host
      .querySelector('.map-desktop g[aria-label^="Есиль"]')!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
  });
  expect(select.value).toBe("esil");
  expect(host.querySelector(".desktop-plan .plan-list")?.textContent).toContain(
    "Нура",
  );
  const cityMeasure = host.querySelector(
    'article[aria-labelledby="measure-M12"]',
  )!;
  await click(button("Добавить в план", cityMeasure));
  expect(host.querySelector("dialog")).toBeNull();
  expect(host.querySelector(".desktop-plan .plan-list")?.textContent).toContain(
    "Весь город",
  );
  await click(button("Сбросить"));
  expect(select.value).toBe("");
  expect(host.querySelector(".map-selected")).toBeNull();
  expect(text()).toContain("Выбрано 2 из 5");
  const clinic = host.querySelector('article[aria-labelledby="measure-M8"]')!;
  await click(button("Выбрать район", clinic));
  expect(host.querySelector("dialog input:checked")).toBeNull();
  expect(
    button("Добавить в план", host.querySelector("dialog")!).disabled,
  ).toBe(true);
});
it("предвыбранный несовместимый район требует смены, а оценки схемы берутся из модели", async () => {
  expect(host.querySelector(".map-desktop")?.textContent).toContain("49,18");
  expect(host.querySelector(".map-desktop")?.textContent).toContain(
    "2 критических показателя",
  );
  expect(text()).toContain("Добавьте ещё 5 мероприятий");
  const select = host.querySelector<HTMLSelectElement>("#district-context")!;
  await act(async () => {
    select.value = "nura";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await click(
    button(
      "Выбрать район",
      host.querySelector('article[aria-labelledby="measure-M7"]')!,
    ),
  );
  await click(button("Добавить в план", host.querySelector("dialog")!));
  await click(
    button(
      "Выбрать район",
      host.querySelector('article[aria-labelledby="measure-M4"]')!,
    ),
  );
  const modal = host.querySelector("dialog")!;
  expect(button("Добавить в план", modal).disabled).toBe(true);
  expect(modal.textContent).toContain("несовместимы в одном районе");
  await click(modal.querySelector('input[value="esil"]')!);
  expect(button("Добавить в план", modal).disabled).toBe(false);
});
