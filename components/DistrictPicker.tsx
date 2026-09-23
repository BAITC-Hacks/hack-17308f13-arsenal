"use client";
import { useState } from "react";
import Modal from "./Modal";
import { city } from "../data/city";
import { labels, keys } from "../data/rules";
import { previewDecision } from "../lib/validate";
import type { Decision, Measure } from "../lib/types";
export default function DistrictPicker({
  measure,
  decisions,
  editing,
  initialDistrictId = "",
  onClose,
  onConfirm,
}: {
  measure: Measure;
  decisions: Decision[];
  editing: boolean;
  initialDistrictId?: string;
  onClose: () => void;
  onConfirm: (next: Decision[]) => void;
}) {
  const [districtId, setDistrictId] = useState(
    editing
      ? (decisions.find((d) => d.measureId === measure.id)?.districtId ?? "")
      : initialDistrictId,
  );
  const selected = districtId
    ? previewDecision(decisions, { measureId: measure.id, districtId }, editing)
    : null;
  return (
    <Modal
      title={editing ? "Изменить район" : "Выберите район"}
      onClose={onClose}
    >
      <h3>{measure.name}</h3>
      <p>
        {measure.cost} условных единиц · Начало действия через {measure.lag} кв.
      </p>
      <p className="muted">
        Сравните исходные показатели. Критические значения — строго ниже 40 из
        100.
      </p>
      <fieldset className="district-options">
        <legend className="sr-only">Район мероприятия</legend>
        {city.map((d) => {
          const preview = previewDecision(
            decisions,
            { measureId: measure.id, districtId: d.id },
            editing,
          );
          return (
            <label
              className={
                "district-option " + (!preview.valid ? "unavailable" : "")
              }
              key={d.id}
            >
              <div className="row">
                <span>
                  <input
                    type="radio"
                    name="district"
                    value={d.id}
                    checked={districtId === d.id}
                    disabled={!preview.valid}
                    onChange={() => setDistrictId(d.id)}
                  />{" "}
                  <b>{d.name}</b>
                </span>
                {districtId === d.id && <span className="badge">Выбран</span>}
              </div>
              {keys
                .filter((k) => measure.effects[k] !== undefined)
                .map((k) => (
                  <p key={k}>
                    {labels[k]}: <b>{d.indicators[k]}/100</b>
                    {d.indicators[k] < 40 && (
                      <span className="critical-label">
                        Критическое значение
                      </span>
                    )}
                  </p>
                ))}
              {preview.errors.map((reason) => (
                <p className="warning" key={reason}>
                  {reason}
                </p>
              ))}
            </label>
          );
        })}
      </fieldset>
      {!districtId && (
        <p className="hint">Выберите один район, чтобы продолжить.</p>
      )}
      {selected?.errors.map((e) => (
        <p className="warning" key={e}>
          {e}
        </p>
      ))}
      <button
        className="primary full"
        disabled={!selected?.valid}
        onClick={() => {
          if (selected?.valid) onConfirm(selected.next);
        }}
      >
        {editing ? "Сохранить район" : "Добавить в план"}
      </button>
    </Modal>
  );
}
