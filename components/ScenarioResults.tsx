import { keys, labels } from "../data/rules";
import { measures } from "../data/measures";
import { format, signed, plural } from "../lib/format";
import type { Simulation } from "../lib/simulate";
import type { AiState } from "../lib/ai-client";
import AiAdvisor from "./AiAdvisor";
import DistrictComparison from "./DistrictComparison";
export function Synergies({ result }: { result: Simulation }) {
  return (
    <div>
      {result.synergies.length ? (
        result.synergies.map((s) => (
          <p key={s.pair}>
            <b>
              {s.pair
                .split(" + ")
                .map((id) => measures.find((m) => m.id === id)!.name)
                .join(" + ")}
            </b>
            <br />
            {s.districtName} · {labels[s.indicator]} +{s.effect}
          </p>
        ))
      ) : (
        <p className="muted">
          Выбранные мероприятия не усиливают друг друга в этой модели.
        </p>
      )}
    </div>
  );
}
export default function ScenarioResults({
  result,
  ai,
  onRetry,
  onEdit,
  onReset,
}: {
  result: Simulation;
  ai: AiState;
  onRetry: () => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="result-hero">
        <div>
          <h2>Индекс качества жизни</h2>
          <p className="score-subtitle">Astana Quality of Life Score</p>
          <strong>
            {format(result.before.score)} <span>→</span>{" "}
            {format(result.after.score)}
          </strong>
          <p>
            {result.delta > 0
              ? "Качество жизни в модели улучшилось."
              : result.delta < 0
                ? "Качество жизни в модели снизилось."
                : "Итоговый балл не изменился."}
          </p>
        </div>
        <div>
          <b>{signed(result.delta)}</b>
          <p>
            {plural(
              Number(
                format(Math.abs(result.delta))
                  .replace(/\s/g, "")
                  .replace(",", "."),
              ),
              "балл",
              "балла",
              "баллов",
            )}{" "}
            · через 2 условных года
          </p>
        </div>
      </div>
      <div className="result-facts">
        <p>
          <b>{result.spent} из 100</b> потрачено · осталось {result.remaining}{" "}
          ед.
        </p>
        <p>
          Показателей ниже нормы:{" "}
          <b>
            {result.before.critical.length} → {result.after.critical.length}
          </b>
        </p>
      </div>
      <p className="hint">
        В этой модели критическими считаются отдельные показатели со значением
        ниже 40 из 100.
      </p>
      <div className="page-actions">
        <button className="primary" onClick={onEdit}>
          Изменить план
        </button>
        <button onClick={onReset}>Сбросить план</button>
      </div>
      <AiAdvisor state={ai} onRetry={onRetry} />
      <DistrictComparison result={result} />
      <details className="card calculation">
        <summary>Подробности и формула расчёта</summary>
        <div className="attention">
          <h2>Что требует внимания</h2>
          {result.after.critical.length ? (
            result.after.critical.map((c) => (
              <p className="caution" key={c.districtId + c.indicator}>
                {c.districtName} · {labels[c.indicator]}: {format(c.value)}/100
                — критическое значение
              </p>
            ))
          ) : (
            <p className="positive">
              Критических показателей не осталось. Это не означает, что все
              проблемы города решены.
            </p>
          )}
          <p className="hint">
            Критический порог — строго ниже 40. Данные синтетические.
          </p>
        </div>

        <p>
          Горизонт — 8 кварталов. Эффект каждого мероприятия умножается на (8 −
          задержка) / 8. Дополнительные эффекты сочетаний мероприятий
          добавляются без уменьшения. Затем показатели ограничиваются диапазоном
          0–100.
        </p>
        <p>
          Индекс качества жизни = 0,7 × средний балл города + 0,3 × минимальный
          районный балл − число критических показателей.
        </p>
        <p>
          Средний балл: {format(result.before.average)} →{" "}
          {format(result.after.average)}. Минимальный:{" "}
          {format(result.before.minimum)} → {format(result.after.minimum)}.
        </p>
        <h3>Из чего складывается изменение индекса качества жизни</h3>
        <dl>
          {[
            ["Средний городской балл", result.decomposition.average],
            ["Минимальный районный балл", result.decomposition.minimum],
            ["Изменение штрафа", result.decomposition.penalty],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{signed(value as number)}</dd>
            </div>
          ))}
        </dl>
        <h3>Какие мероприятия усиливают друг друга</h3>
        <Synergies result={result} />
        <h3>Подробные показатели</h3>
        {result.after.districts.map((d, i) => (
          <details key={d.id}>
            <summary>{d.name}</summary>
            <dl>
              {keys.map((k) => (
                <div key={k}>
                  <dt>{labels[k]}</dt>
                  <dd>
                    {format(result.before.districts[i].indicators[k])} →{" "}
                    {format(d.indicators[k])} (
                    {signed(result.districtDeltas[i].indicators[k])})
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
        <h3>Эффекты мероприятий с учётом задержки</h3>
        <p>
          Это изменения показателей, а не аддитивные вклады в индекс качества
          жизни: формула содержит минимум и пороговые штрафы.
        </p>
        {result.realizedEffects.map((m) => (
          <p key={m.id}>
            <b>{m.name}:</b>{" "}
            {Object.entries(m.effects)
              .map(
                ([k, v]) => `${labels[k as keyof typeof labels]} ${signed(v)}`,
              )
              .join("; ")}
          </p>
        ))}
      </details>
    </>
  );
}
