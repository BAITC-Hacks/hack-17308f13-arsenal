import { calculateBaseline } from "../lib/simulate";
import { format } from "../lib/format";
import { keys, labels } from "../data/rules";
const baseline = calculateBaseline();
export default function DistrictOverview() {
  return (
    <details className="card district-overview">
      <summary>Посмотреть проблемы районов</summary>
      <p className="muted">
        Исходный Score: {format(baseline.score)} · Критических показателей:{" "}
        {baseline.critical.length}. Чем выше значение, тем лучше.
      </p>
      <div className="district-grid">
        {baseline.districts.map((d) => (
          <article key={d.id}>
            <h3>
              {d.name} <span className="badge">{format(d.score)}</span>
            </h3>
            <p>{d.description}</p>
            {baseline.critical
              .filter((c) => c.districtId === d.id)
              .map((c) => (
                <p className="caution" key={c.indicator}>
                  Критическое: {labels[c.indicator]} — {c.value}/100
                </p>
              ))}
            <details>
              <summary>Все показатели</summary>
              <dl>
                {keys.map((k) => (
                  <div key={k}>
                    <dt>{labels[k]}</dt>
                    <dd>{d.indicators[k]}/100</dd>
                  </div>
                ))}
              </dl>
            </details>
          </article>
        ))}
      </div>
    </details>
  );
}
