import type { AiState } from "../lib/ai-client";
export default function AiAdvisor({
  state,
  onRetry,
}: {
  state: AiState;
  onRetry: () => void;
}) {
  return (
    <section className="card advisor" aria-labelledby="ai-title">
      <h2 id="ai-title">AI-разбор вашего плана</h2>
      <p className="hint">
        AI выбирает факты о плане. Числа берутся из расчёта учебной модели.
      </p>
      <div aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "loading" && (
          <p role="status">Анализируем ваш план…</p>
        )}
        {state.status === "disabled" && (
          <p>AI-разбор сейчас недоступен. Результаты расчёта доступны.</p>
        )}
        {state.status === "error" && (
          <p role="alert">
            Не удалось получить AI-разбор. Результаты расчёта доступны.
          </p>
        )}
        {state.status === "success" && state.analysis && (
          <>
            <div className="analysis-summary">
              {[
                ["Главное улучшение", state.analysis.improvement],
                ["Что осталось проблемой", state.analysis.problem],
                ["Что можно изменить", state.analysis.next],
              ].map(([title, text]) => (
                <div key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
            {state.analysis.details.length > 0 && (
              <details>
                <summary>Подробный анализ</summary>
                {state.analysis.details.map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
              </details>
            )}
          </>
        )}
      </div>
      {(state.status === "error" || state.status === "disabled") && (
        <button onClick={onRetry}>Повторить анализ</button>
      )}
    </section>
  );
}
