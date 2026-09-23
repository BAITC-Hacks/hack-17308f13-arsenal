import { plural } from "../lib/format";
import { measureDescription } from "../lib/measure-copy";
import { useState } from "react";
import { city } from "../data/city";
import { measures } from "../data/measures";
import { directions, labels } from "../data/rules";
import { previewDecision } from "../lib/validate";
import type { Decision, Direction, Measure, Indicator } from "../lib/types";
export default function MeasureCatalog({
  decisions,
  selectedDistrictId,
  onChooseDistrict,
  onAdd,
}: {
  decisions: Decision[];
  selectedDistrictId: string;
  onChooseDistrict: () => void;
  onAdd: (measure: Measure) => void;
}) {
  const [filter, setFilter] = useState<Direction | "all">("all");
  return (
    <section aria-label="Каталог мероприятий">
      {decisions.length === 5 && (
        <p className="catalog-complete" role="status">
          Выбраны все 5 мероприятий. Перейдите к проверке или удалите
          мероприятие для замены.
        </p>
      )}
      <div className="filters" aria-label="Направления">
        {["all", ...Object.keys(directions)].map((dir) => (
          <button
            key={dir}
            aria-pressed={filter === dir}
            className={filter === dir ? "active" : ""}
            onClick={() => setFilter(dir as Direction | "all")}
          >
            {dir === "all" ? "Все" : directions[dir as Direction]}
          </button>
        ))}
      </div>
      <div className="catalog">
        {measures
          .filter((m) => filter === "all" || m.direction === filter)
          .map((m) => {
            const selected = decisions.find((d) => d.measureId === m.id);
            const districtName = city.find(
              (d) => d.id === selectedDistrictId,
            )?.name;
            const previews =
              m.scope === "city"
                ? [previewDecision(decisions, { measureId: m.id })]
                : (selectedDistrictId
                    ? city.filter((d) => d.id === selectedDistrictId)
                    : city
                  ).map((d) =>
                    previewDecision(decisions, {
                      measureId: m.id,
                      districtId: d.id,
                    }),
                  );
            const allowed = previews.some((p) => p.valid),
              reasons =
                allowed || decisions.length === 5 ? [] : previews[0].errors;
            const negative = Object.entries(m.effects).filter(([, v]) => v < 0);
            return (
              <article
                className={"card measure " + (selected ? "chosen" : "")}
                key={m.id}
                aria-labelledby={`measure-${m.id}`}
              >
                <div className="row">
                  <span className="eyebrow">{directions[m.direction]}</span>
                  <b className="price">{m.cost} ед.</b>
                </div>
                <h3 id={`measure-${m.id}`}>{m.name}</h3>
                <p className="effect-description">{measureDescription(m)}</p>
                {negative.map(([k]) => (
                  <p key={k} className="caution">
                    {k === "T1"
                      ? "В модели также увеличивается загруженность дорог."
                      : `В модели также снижается показатель «${labels[k as Indicator].toLocaleLowerCase("ru")}».`}
                  </p>
                ))}
                <p className="meta">
                  Начнёт действовать через {m.lag}{" "}
                  {plural(m.lag, "квартал", "квартала", "кварталов")}
                </p>
                <details>
                  <summary>Подробнее</summary>
                  <p className="hint">
                    Ниже — полные изменения отдельных показателей, до учёта
                    задержки. В итоговом расчёте каждое число умножается на (8 −{" "}
                    {m.lag}) / 8: мероприятие действует не все 8 кварталов. Это
                    не изменение общего индекса. Эффекты с учётом задержки можно
                    посмотреть в подробностях результата.
                  </p>
                  <ul className="effects">
                    {Object.entries(m.effects).map(([k, v]) => (
                      <li key={k} className={v < 0 ? "negative" : ""}>
                        {labels[k as Indicator]}{" "}
                        <b>
                          {v > 0 ? "+" : ""}
                          {v}
                        </b>
                      </li>
                    ))}
                  </ul>
                </details>
                <div className="card-action">
                  <p className="measure-target">
                    <strong>
                      {m.scope === "city"
                        ? "Действует на весь город"
                        : `Район: ${selected ? city.find((d) => d.id === selected.districtId)?.name : (districtName ?? "не выбран")}`}
                    </strong>
                  </p>
                  <button
                    className={selected ? "" : "outline-primary"}
                    disabled={!selected && !allowed}
                    aria-disabled={!!selected || !allowed}
                    aria-describedby={
                      reasons.length ? `reason-${m.id}` : undefined
                    }
                    onClick={() => {
                      if (selected || !allowed) return;
                      if (m.scope === "district" && !selectedDistrictId) {
                        onChooseDistrict();
                        return;
                      }
                      onAdd(m);
                    }}
                  >
                    {selected
                      ? `В плане · ${city.find((d) => d.id === selected.districtId)?.name ?? "Весь город"}`
                      : m.scope === "district" && !selectedDistrictId
                        ? "Выбрать район"
                        : "Добавить в план"}
                  </button>
                  {!selected && reasons.length > 0 && (
                    <div id={`reason-${m.id}`} className="action-reason">
                      {reasons.map((reason) => (
                        <p key={reason}>{reason}</p>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
      </div>
    </section>
  );
}
