import { calculateBaseline } from "../lib/simulate";
import { format, plural } from "../lib/format";
import geography from "../data/geography/astana-2023.json";

const baseline = calculateBaseline();
// Label placement only. District/river geometry is traced from the licensed source.
const labels: Record<string, { x: number; y: number; leader?: string }> = {
  saryarka: { x: 25, y: 300, leader: "M125 315 L170 315 L200 330" },
  baikonur: { x: 350, y: 268 },
  almaty: { x: 575, y: 428 },
  nura: { x: 155, y: 555 },
  esil: { x: 395, y: 641 },
};
export default function DistrictMap({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section
      className="district-map card"
      aria-label="Выбор района для новых мероприятий"
    >
      <div className="map-controls">
        <label htmlFor="district-context">Выберите район для мероприятий</label>
        <select
          id="district-context"
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">Район не выбран</option>
          {baseline.districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <p>
          Районные мероприятия добавляются в выбранный район. Выбор другого
          района не меняет уже составленный план.
        </p>
        <p className="map-legend">
          <span aria-hidden="true" className="legend-critical">
            !
          </span>{" "}
          Число критических показателей
        </p>
        <p>Оценки — исходные, по синтетическим данным.</p>
      </div>
      <figure>
        <svg
          className="map-desktop geographic-map"
          viewBox="-90 48 860 910"
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="Схематичная карта пяти районов Астаны по карте 2023 года, север сверху"
        >
          <title>
            Пять районов Астаны: схематичная векторизация карты 2023 года
          </title>
          <desc>
            Контуры упрощены по карте Bogomolov.PL. Голубым показан центральный
            участок реки Есиль. Это не точная административная карта.
          </desc>
          {baseline.districts.map((d) => {
            const critical = baseline.critical.filter(
              (c) => c.districtId === d.id,
            ).length;
            return (
              <g
                key={d.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected === d.id}
                aria-label={`${d.name}, исходная оценка ${format(d.score)}${critical ? `, критических показателей: ${critical}` : ""}`}
                className={`map-region ${critical ? "map-critical" : ""} ${selected === d.id ? "map-selected" : ""}`}
                onClick={() => onSelect(d.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(d.id);
                  }
                }}
              >
                <title>{`${d.name}${critical ? `: ${critical} ${plural(critical, "критический показатель", "критических показателя", "критических показателей")}` : ""}`}</title>
                <path
                  className="district-shape"
                  vectorEffect="non-scaling-stroke"
                  d={
                    geography.districts[
                      d.id as keyof typeof geography.districts
                    ]
                  }
                />
              </g>
            );
          })}
          <path
            className="map-river"
            d={geography.river}
            vectorEffect="non-scaling-stroke"
            aria-hidden="true"
          />
          <text className="river-label" x="227" y="458" aria-hidden="true">
            Есиль
          </text>
          {/* Labels are separate clickable targets so adjoining shapes cannot paint over them. */}
          {baseline.districts.map((d) => {
            const position = labels[d.id],
              critical = baseline.critical.filter(
                (c) => c.districtId === d.id,
              ).length;
            return (
              <g
                key={d.id}
                className={`map-label ${selected === d.id ? "label-selected" : ""}`}
                aria-hidden="true"
                onClick={() => onSelect(d.id)}
              >
                {position.leader && (
                  <path
                    className="map-leader"
                    d={position.leader}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <rect
                  x={position.x - 113}
                  y={position.y - 31}
                  width="226"
                  height="84"
                  rx="15"
                />
                <text x={position.x} y={position.y} className="map-name">
                  {d.name}
                </text>
                <text x={position.x} y={position.y + 36} className="map-score">
                  {format(d.score)}
                </text>
                {critical > 0 && (
                  <g className="map-critical-badge">
                    <circle cx={position.x + 82} cy={position.y + 28} r="20" />
                    <text x={position.x + 82} y={position.y + 38}>
                      {critical}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          <g className="north-marker" aria-hidden="true">
            <path
              d="M735 166 V100 M721 122 L735 100 L749 122"
              vectorEffect="non-scaling-stroke"
            />
            <text x="735" y="82">
              С
            </text>
          </g>
        </svg>
        <figcaption>
          <span>Схематичные границы. Пять районов по условиям кейса.</span>
          <span>
            По{" "}
            <a href={geography.source} target="_blank" rel="noreferrer">
              карте 2023 года
            </a>{" "}
            · Bogomolov.PL ·{" "}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY-SA 4.0
            </a>
            . Контуры и река упрощены.
          </span>
        </figcaption>
      </figure>
    </section>
  );
}
