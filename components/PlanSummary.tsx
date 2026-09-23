import { city } from "../data/city";
import { measures } from "../data/measures";
import { validateScenario } from "../lib/validate";
import type { Decision, Measure } from "../lib/types";
export function PlanList({
  decisions,
  onEdit,
  onRemove,
}: {
  decisions: Decision[];
  onEdit?: (m: Measure) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <ol className="plan-list">
      {decisions.map((d) => {
        const m = measures.find((m) => m.id === d.measureId)!;
        return (
          <li key={m.id}>
            <div className="row">
              <h3>{m.name}</h3>
              <b className="price">{m.cost} ед.</b>
            </div>
            <p className="muted">
              {city.find((c) => c.id === d.districtId)?.name ?? "Весь город"}
            </p>
            {onRemove && (
              <div className="plan-actions">
                {m.scope === "district" && onEdit && (
                  <button
                    aria-label={`Изменить район: ${m.name}`}
                    onClick={() => onEdit(m)}
                  >
                    Изменить район
                  </button>
                )}
                <button
                  aria-label={`Удалить: ${m.name}`}
                  onClick={() => onRemove(m.id)}
                >
                  Удалить
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
export function remainingHint(count: number) {
  const n = 5 - count;
  return n > 0
    ? `Добавьте ещё ${n} ${n === 1 ? "мероприятие" : n < 5 ? "мероприятия" : "мероприятий"}`
    : "Пять решений выбраны. Можно проверить план.";
}
export default function PlanSummary({
  decisions,
  onEdit,
  onRemove,
  onReview,
}: {
  decisions: Decision[];
  onEdit: (m: Measure) => void;
  onRemove: (id: string) => void;
  onReview: () => void;
}) {
  const validation = validateScenario(decisions),
    draft = validateScenario(decisions, { partial: true });
  return (
    <div className="plan-summary">
      <h2>Ваш план</h2>
      <div className="budget">
        <b>Использовано {draft.spent} из 100</b>
        <progress
          aria-label="Использованный бюджет"
          value={draft.spent}
          max={100}
        />
        <div className="row">
          <span>Остаток: {100 - draft.spent} ед.</span>
          <span>Выбрано {decisions.length} из 5</span>
        </div>
      </div>
      {decisions.length ? (
        <PlanList decisions={decisions} onEdit={onEdit} onRemove={onRemove} />
      ) : (
        <p className="empty">
          Выберите мероприятие в каталоге. Для районной меры мы поможем сравнить
          районы.
        </p>
      )}
      <p className="hint" aria-live="polite">
        {remainingHint(decisions.length)}
      </p>
      {draft.errors.map((e) => (
        <p className="warning" key={e}>
          {e}
        </p>
      ))}
      <button
        className="primary full"
        disabled={!validation.valid}
        onClick={onReview}
      >
        Проверить план →
      </button>
    </div>
  );
}
