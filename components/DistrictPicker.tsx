"use client";
import { useState } from "react";
import Modal from "./Modal";
import { city } from "../data/city";
import { previewDecision } from "../lib/validate";
import type { Decision, Measure } from "../lib/types";
export default function DistrictPicker({
  measure,
  decisions,
  onClose,
  onConfirm,
}: {
  measure: Measure;
  decisions: Decision[];
  onClose: () => void;
  onConfirm: (next: Decision[]) => void;
}) {
  const [districtId, setDistrictId] = useState(
    decisions.find((d) => d.measureId === measure.id)?.districtId ?? "",
  );
  const selected = previewDecision(
    decisions,
    { measureId: measure.id, districtId },
    true,
  );
  return (
    <Modal title="Изменить район" onClose={onClose}>
      <div className="compact-district-editor">
        <h3>{measure.name}</h3>
        <fieldset className="district-options">
          <legend className="sr-only">Новый район мероприятия</legend>
          {city.map((d) => {
            const check = previewDecision(
              decisions,
              { measureId: measure.id, districtId: d.id },
              true,
            );
            return (
              <label
                className={
                  "district-option " + (!check.valid ? "unavailable" : "")
                }
                key={d.id}
              >
                <span>
                  <input
                    type="radio"
                    name="district"
                    value={d.id}
                    checked={districtId === d.id}
                    disabled={!check.valid}
                    onChange={() => setDistrictId(d.id)}
                  />
                  <b>{d.name}</b>
                </span>
                {check.errors.map((e) => (
                  <p className="warning" key={e}>
                    {e}
                  </p>
                ))}
              </label>
            );
          })}
        </fieldset>
        <div className="district-save">
          <button
            className="primary full"
            disabled={!selected.valid}
            onClick={() => {
              const current = previewDecision(
                decisions,
                { measureId: measure.id, districtId },
                true,
              );
              if (current.valid) onConfirm(current.next);
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </Modal>
  );
}
