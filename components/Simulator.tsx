"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { example } from "../data/example";
import { validateScenario } from "../lib/validate";
import { scenarioId } from "../lib/scenario-schema";
import { simulateScenario, type Simulation } from "../lib/simulate";
import { AnalysisRequest, type AiState } from "../lib/ai-client";
import type { Decision, Measure } from "../lib/types";
import Modal from "./Modal";
import DistrictPicker from "./DistrictPicker";
import DistrictOverview from "./DistrictOverview";
import DistrictMap from "./DistrictMap";
import { city } from "../data/city";
import MeasureCatalog from "./MeasureCatalog";
import PlanSummary, { PlanList, remainingHint } from "./PlanSummary";
import ScenarioResults, { Synergies } from "./ScenarioResults";

type Step = 1 | 2 | 3;
export default function Simulator() {
  const [districtContext, setDistrictContext] = useState("");
  const [step, setStep] = useState<Step>(1),
    [decisions, setDecisions] = useState<Decision[]>([]),
    [reviewed, setReviewed] = useState(false),
    [result, setResult] = useState<Simulation | null>(null),
    [ai, setAi] = useState<AiState>({ status: "idle" });
  const [picker, setPicker] = useState<{
      measure: Measure;
      editing: boolean;
    } | null>(null),
    [mobilePlan, setMobilePlan] = useState(false),
    [confirmation, setConfirmation] = useState<"reset" | "example" | null>(
      null,
    ),
    [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null),
    calculating = useRef(false);
  const analysis = useRef<AnalysisRequest | null>(null);
  if (!analysis.current) analysis.current = new AnalysisRequest(setAi);
  useEffect(() => () => analysis.current?.dispose(), []);
  useLayoutEffect(() => {
    if (step !== 3) calculating.current = false;
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  const validation = validateScenario(decisions),
    draft = validateScenario(decisions, { partial: true });
  // Reuse the existing engine for the review's synergy preview. It is never shown as a result until confirmed.
  const preview = useMemo(
    () =>
      step === 2 && validateScenario(decisions).valid
        ? simulateScenario(decisions)
        : null,
    [step, decisions],
  );
  function change(next: Decision[]) {
    analysis.current!.invalidate();
    setResult(null);
    setReviewed(false);
    setNotice("");
    setDecisions(next);
  }
  function navigate(next: Step) {
    if (next === 2 && (!reviewed || !validation.valid)) return;
    if (next === 3 && !result) return;
    setStep(next);
  }
  function review() {
    if (!validation.valid) return;
    setMobilePlan(false);
    setReviewed(true);
    setStep(2);
  }
  function calculate() {
    if (calculating.current || !validation.valid) return;
    calculating.current = true;
    try {
      const next =
        result?.scenarioId === scenarioId(decisions)
          ? result
          : simulateScenario(decisions);
      setResult(next);
      setStep(3);
      void analysis.current!.run(decisions, next.scenarioId);
    } catch {
      calculating.current = false;
      setNotice("Не удалось рассчитать план. Вернитесь к выбору мероприятий.");
    }
  }
  function edit(m: Measure) {
    setPicker({ measure: m, editing: true });
  }
  function remove(id: string) {
    change(decisions.filter((d) => d.measureId !== id));
  }
  function confirm() {
    const action = confirmation;
    setConfirmation(null);
    setMobilePlan(false);
    setPicker(null);
    change(action === "example" ? structuredClone(example) : []);
    setStep(1);
    if (step === 1)
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        heading.current?.focus();
      });
  }
  const title =
    step === 1
      ? "Какие изменения нужны городу?"
      : step === 2
        ? validation.valid
          ? "Всё готово к расчёту"
          : "План требует исправления"
        : "Результат вашего плана";
  const plan = (
    <PlanSummary
      decisions={decisions}
      onEdit={edit}
      onRemove={remove}
      onReview={review}
    />
  );
  return (
    <main className={step === 1 ? "with-mobile-bar" : ""}>
      <header>
        <div className="brand" aria-hidden="true">
          А<span>5</span>
        </div>
        <div>
          <b className="project-name">Аким на 5 часов</b>
          <p className="header-caption">Симулятор · Синтетические данные</p>
        </div>
      </header>
      <nav aria-label="Шаги плана" className="steps">
        {(["Собрать план", "Проверить", "Результат"] as const).map(
          (label, i) => {
            const target = (i + 1) as Step;
            return (
              <button
                key={label}
                className={step === target ? "current" : ""}
                aria-current={step === target ? "step" : undefined}
                disabled={
                  target === 2
                    ? !reviewed || !validation.valid
                    : target === 3
                      ? !result
                      : false
                }
                onClick={() => navigate(target)}
              >
                <span>{i + 1}</span>
                {label}
              </button>
            );
          },
        )}
      </nav>
      <section
        aria-labelledby="step-heading"
        className={"step-content step-" + step}
      >
        <div className="step-heading">
          <p className="eyebrow">ШАГ {step} ИЗ 3</p>
          <h1 id="step-heading" ref={heading} tabIndex={-1}>
            {title}
          </h1>
          {step === 1 && (
            <p>Выберите 5 мероприятий на 100 единиц и сравните результат.</p>
          )}
          {step === 2 && validation.valid && (
            <p>
              Проверьте районы и бюджет. Расчёт покажет изменения через два
              условных года.
            </p>
          )}
        </div>
        {step === 1 && (
          <>
            <ul className="rules">
              <li>Ровно 5 решений</li>
              <li>Не более 2 мер из одного направления</li>
              <li>Бюджет до 100 единиц</li>
            </ul>
            <p className="hint">
              Выбирать по одной мере каждого направления необязательно.
            </p>
            <DistrictMap
              selected={districtContext}
              onSelect={setDistrictContext}
            />
            <DistrictOverview />
            <div className="catalog-context" aria-live="polite">
              <span>
                Район:{" "}
                <b>
                  {city.find((d) => d.id === districtContext)?.name ??
                    "не выбран"}
                </b>
              </span>
              {districtContext && (
                <button onClick={() => setDistrictContext("")}>Сбросить</button>
              )}
            </div>
            <div className="build-toolbar">
              <h2>Мероприятия для вашего плана</h2>
              <button
                onClick={() =>
                  decisions.length
                    ? setConfirmation("example")
                    : (change(structuredClone(example)),
                      setNotice(
                        "Пример загружен. Проверьте пять выбранных мероприятий.",
                      ))
                }
              >
                Загрузить пример
              </button>
            </div>
            {notice && (
              <p role="status" className="caution">
                {notice}
              </p>
            )}
            <div className="workspace">
              <MeasureCatalog
                decisions={decisions}
                onDistrict={(measure) => setPicker({ measure, editing: false })}
                onAdd={change}
              />
              <aside className="card desktop-plan" aria-label="Ваш план">
                {plan}
                {decisions.length > 0 && (
                  <button
                    className="text-button"
                    onClick={() => setConfirmation("reset")}
                  >
                    Начать заново
                  </button>
                )}
              </aside>
            </div>
            <div className="mobile-bar">
              <div className="row">
                <span>{draft.spent}/100 ед.</span>
                <button
                  aria-haspopup="dialog"
                  onClick={() => setMobilePlan(true)}
                >
                  Ваш план · {decisions.length} из 5 ↑
                </button>
              </div>
              <p className="hint">{remainingHint(decisions.length)}</p>
              <button
                className="primary full"
                disabled={!validation.valid}
                onClick={review}
              >
                Проверить план →
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <div className="review-layout">
            <div className="card">
              <h2>Ваши пять решений</h2>
              <PlanList decisions={decisions} />
            </div>
            <div className="review-side">
              <div className="card">
                <h2>Бюджет плана</h2>
                <p className="large-number">
                  {draft.spent} <span>из 100 ед.</span>
                </p>
                <p>Остаток: {100 - draft.spent} ед.</p>
                {validation.errors.map((e) => (
                  <p className="warning" key={e}>
                    {e}
                  </p>
                ))}
                <button
                  className="primary full"
                  disabled={!validation.valid}
                  onClick={calculate}
                >
                  Рассчитать результат →
                </button>
                <button className="full" onClick={() => setStep(1)}>
                  Изменить план
                </button>
              </div>
              {preview && (
                <div className="card">
                  <h2>Совместные эффекты</h2>
                  <Synergies result={preview} />
                </div>
              )}
            </div>
          </div>
        )}
        {step === 3 && result && (
          <ScenarioResults
            result={result}
            ai={ai.scenarioId === result.scenarioId ? ai : { status: "idle" }}
            onRetry={() =>
              void analysis.current!.run(decisions, result.scenarioId, true)
            }
            onEdit={() => setStep(1)}
            onReset={() => setConfirmation("reset")}
          />
        )}
      </section>
      <footer>
        Учебная модель на синтетических данных. Результаты не являются реальным
        прогнозом развития Астаны.
      </footer>
      {mobilePlan && (
        <Modal title="Ваш план" onClose={() => setMobilePlan(false)}>
          {plan}
          {decisions.length > 0 && (
            <button onClick={() => setConfirmation("reset")}>
              Начать заново
            </button>
          )}
        </Modal>
      )}
      {picker && (
        <DistrictPicker
          measure={picker.measure}
          editing={picker.editing}
          initialDistrictId={districtContext}
          decisions={decisions}
          onClose={() => setPicker(null)}
          onConfirm={(next) => {
            const name = picker.measure.name;
            change(next);
            setPicker(null);
            setNotice(`«${name}»: план обновлён.`);
          }}
        />
      )}
      {confirmation && (
        <Modal
          title={
            confirmation === "reset"
              ? "Начать заново?"
              : "Заменить план примером?"
          }
          onClose={() => setConfirmation(null)}
        >
          <p>
            {confirmation === "reset"
              ? "Все выбранные мероприятия и результат будут удалены."
              : "Текущие решения будут заменены готовым примером."}
          </p>
          <div className="page-actions">
            <button onClick={() => setConfirmation(null)}>
              Сохранить текущий план
            </button>
            <button className="primary" onClick={confirm}>
              {confirmation === "reset"
                ? "Да, начать заново"
                : "Загрузить пример"}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
