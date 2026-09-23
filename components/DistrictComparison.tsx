import { format } from "../lib/format";
import type { Simulation } from "../lib/simulate";

export default function DistrictComparison({ result }: { result: Simulation }) {
  // The simulator preserves the dataset's fixed district order; join values by ID.
  const rows = result.before.districts.map((district) => ({
    id: district.id,
    name: district.name,
    before: district.score,
    after: result.after.districts.find((d) => d.id === district.id)!.score,
    delta: result.districtDeltas.find((d) => d.id === district.id)!.score,
  }));
  const deltaText = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "−" : ""}${format(Math.abs(value))}`;
  const deltaClass = (value: number) =>
    value > 0 ? "positive" : value < 0 ? "negative" : "muted";
  return (
    <section
      className="card district-results"
      aria-labelledby="district-comparison-title"
    >
      <h2 id="district-comparison-title">Как изменились районы</h2>
      <p className="muted">Оценка района от 0 до 100. Чем выше, тем лучше</p>
      <div className="comparison-legend">
        <span>
          <i className="comparison-before" aria-hidden="true" />
          До
        </span>
        <span>
          <i className="comparison-after" aria-hidden="true" />
          После
        </span>
      </div>
      <ul className="district-comparison">
        {rows.map((row) => (
          <li key={row.id} data-district={row.id}>
            <strong className="comparison-name">{row.name}</strong>
            <div className="comparison-bars">
              {(
                [
                  ["До", row.before, "before"],
                  ["После", row.after, "after"],
                ] as const
              ).map(([label, value, period]) => (
                <div className="comparison-bar-row" key={period}>
                  <span className="comparison-period">{label}</span>
                  <span className="comparison-track" aria-hidden="true">
                    <span
                      className={`comparison-fill comparison-${period}`}
                      style={{ width: `${value}%` }}
                    />
                  </span>
                  <span className="comparison-value">{format(value)}</span>
                </div>
              ))}
            </div>
            <b
              className={`comparison-delta ${deltaClass(row.delta)}`}
              aria-label={`Изменение: ${deltaText(row.delta)}`}
            >
              {deltaText(row.delta)}
            </b>
          </li>
        ))}
      </ul>
      <details className="comparison-exact">
        <summary>Показать точные значения</summary>
        <table>
          <caption className="sr-only">Оценки районов до и после</caption>
          <thead>
            <tr>
              <th scope="col">Район</th>
              <th scope="col">До</th>
              <th scope="col">После</th>
              <th scope="col">Изменение</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.name}</th>
                <td>{format(row.before)}</td>
                <td>{format(row.after)}</td>
                <td className={deltaClass(row.delta)}>
                  {deltaText(row.delta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
