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
                  ×
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
    : "План собран — можно продолжить";
}
export default function PlanSummary({
  decisions,
  selectedDistrictId,
  onEdit,
  onRemove,
  onReview,
}: {
  decisions: Decision[];
  selectedDistrictId: string;
  onEdit: (m: Measure) => void;
  onRemove: (id: string) => void;
  onReview: () => void;
}) {
  const selectedDistrictName = city.find(
    (d) => d.id === selectedDistrictId,
  )?.name;
  const validation = validateScenario(decisions),
    draft = validateScenario(decisions, { partial: true });
  return (
    <div className="plan-summary">
      <h2>Ваш план</h2>
      <div className="budget">
        <b>Бюджет плана: {draft.spent} из 100</b>
        <progress
          aria-label="Использованный бюджет"
          value={draft.spent}
          max={100}
        />
        <div className="row">
          <span>Остаток: {100 - draft.spent} ед.</span>
          <span>Мероприятия: {decisions.length} из 5</span>
        </div>
      </div>
      <div
        className="plan-scroll"
        tabIndex={0}
        role="region"
        aria-label="Выбранные мероприятия"
      >
        {decisions.length ? (
          <PlanList decisions={decisions} onEdit={onEdit} onRemove={onRemove} />
        ) : (
          <p className="empty">
            {selectedDistrictName
              ? `Выбран район ${selectedDistrictName}. Добавьте мероприятия из каталога`
              : "Выберите район на карте или добавьте мероприятие для всего города"}
          </p>
        )}
      </div>
      <div className="plan-footer">
        <p className="hint" aria-live="polite">
          {validation.valid
            ? "План собран — можно продолжить"
            : decisions.length < 5
              ? remainingHint(decisions.length)
              : "Исправьте ограничения плана"}
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
    </div>
  );
}
