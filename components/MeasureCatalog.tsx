import { useState } from "react";
import { city } from "../data/city";
import { measures } from "../data/measures";
import { directions, labels } from "../data/rules";
import { previewDecision } from "../lib/validate";
import type { Decision, Direction, Measure, Indicator } from "../lib/types";
export default function MeasureCatalog({
  decisions,
  onDistrict,
  onAdd,
}: {
  decisions: Decision[];
  onDistrict: (m: Measure) => void;
  onAdd: (next: Decision[]) => void;
}) {
  const [filter, setFilter] = useState<Direction | "all">("all");
  return (
    <section aria-label="Каталог мероприятий">
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
            const selected = decisions.some((d) => d.measureId === m.id);
            const previews =
              m.scope === "city"
                ? [previewDecision(decisions, { measureId: m.id })]
                : city.map((d) =>
                    previewDecision(decisions, {
                      measureId: m.id,
                      districtId: d.id,
                    }),
                  );
            const allowed = previews.some((p) => p.valid),
              reasons = allowed ? [] : previews[0].errors;
            const positive = Object.entries(m.effects)
              .filter(([, v]) => v > 0)
              .map(([k]) => labels[k as Indicator].toLocaleLowerCase("ru"));
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
                <p className="effect-description">
                  Улучшает показатели: {positive.join(", ")}.
                </p>
                {negative.map(([k]) => (
                  <p key={k} className="caution">
                    Компромисс: снижается показатель «
                    {labels[k as Indicator].toLocaleLowerCase("ru")}».
                  </p>
                ))}
                <p className="meta">
                  {m.scope === "city" ? "Весь город" : "Один район"} · Начало
                  через {m.lag} кв.
                </p>
                <details>
                  <summary>Подробнее</summary>
                  <p className="hint">
                    {m.id} · Полные эффекты до учёта задержки. Горизонт расчёта
                    — 8 кварталов.
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
                  <button
                    className={selected ? "" : "outline-primary"}
                    disabled={!selected && !allowed}
                    aria-disabled={selected || !allowed}
                    aria-describedby={
                      reasons.length ? `reason-${m.id}` : undefined
                    }
                    onClick={() => {
                      if (selected || !allowed) return;
                      m.scope === "district"
                        ? onDistrict(m)
                        : onAdd(previews[0].next);
                    }}
                  >
                    {selected
                      ? "✓ В плане"
                      : m.scope === "district"
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
