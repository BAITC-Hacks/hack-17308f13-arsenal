import type { AiState } from "../lib/ai-client";
// Render only text nodes. Recognize the provider's headings without interpreting HTML.
export function AnalysisText({ text }: { text: string }) {
  return (
    <div className="ai-text">
      {text.split(/\n\s*\n/).map((block, i) => {
        const lines = block.split("\n");
        return (
          <div key={i}>
            {lines.map((line, j) => {
              const clean = line
                .trim()
                .replace(/^#{1,6}\s*/, "")
                .replace(/^\*\*(.*?)\*\*:?$/, "$1")
                .replace(/^\d+[.)]\s*/, "");
              const heading =
                /^(Сильные стороны|Оставшиеся проблемы|Компромиссы|Риски|Рекомендации)[:.]?$/.test(
                  clean,
                );
              return heading ? (
                <h3 key={j}>{clean.replace(/[:.]$/, "")}</h3>
              ) : (
                <p key={j}>{line.replace(/^[-*]\s/, "• ")}</p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
export default function AiAdvisor({
  state,
  onRetry,
}: {
  state: AiState;
  onRetry: () => void;
}) {
  return (
    <section className="card advisor" aria-labelledby="ai-title">
      <p className="eyebrow">AI-СОВЕТНИК</p>
      <h2 id="ai-title">Объяснение AI</h2>
      <p className="muted">
        Числа рассчитаны симулятором. AI объясняет сильные стороны, компромиссы,
        риски и рекомендации.
      </p>
      <div aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "loading" && (
          <p role="status">Готовим объяснение вашего плана…</p>
        )}
        {state.status === "disabled" && (
          <p>
            AI-разбор сейчас недоступен: он выключен или ещё не настроен. Расчёт
            готов.
          </p>
        )}
        {state.status === "error" && (
          <p role="alert">Не удалось загрузить AI-разбор. Расчёт готов.</p>
        )}
        {state.status === "success" && state.text && (
          <AnalysisText text={state.text} />
        )}
      </div>
      {(state.status === "error" || state.status === "disabled") && (
        <button onClick={onRetry}>Повторить</button>
      )}
    </section>
  );
}
