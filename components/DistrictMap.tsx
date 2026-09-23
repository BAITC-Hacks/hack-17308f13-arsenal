import { calculateBaseline } from "../lib/simulate";
import { format } from "../lib/format";

const baseline = calculateBaseline();
// Deliberately schematic tiles, not geographic boundaries.
const shapes: Record<string, { path: string; x: number; y: number }> = {
  saryarka: { path: "M12 12 H204 L220 101 H12 Z", x: 110, y: 46 },
  baikonur: { path: "M216 12 H408 V101 H232 Z", x: 314, y: 46 },
  almaty: { path: "M420 12 H608 V208 H432 L420 101 Z", x: 514, y: 81 },
  esil: { path: "M12 113 H220 L238 208 H12 Z", x: 116, y: 149 },
  nura: { path: "M232 113 H420 L432 208 H250 Z", x: 332, y: 141 },
};
const mobileShapes: typeof shapes = {
  saryarka: { path: "M8 8 H148 L152 104 H8 Z", x: 80, y: 40 },
  baikonur: { path: "M160 8 H312 V104 H164 Z", x: 236, y: 40 },
  esil: { path: "M8 112 H152 L148 208 H8 Z", x: 80, y: 144 },
  almaty: { path: "M164 112 H312 V208 H156 Z", x: 236, y: 144 },
  nura: { path: "M8 216 H312 V320 H8 Z", x: 160, y: 248 },
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
        <label htmlFor="district-context">С какого района начнём?</label>
        <select
          id="district-context"
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">Все районы</option>
          {baseline.districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <p>
          Выберите район на схеме или в списке. Он будет предложен для новых
          районных мер.
        </p>
      </div>
      <figure>
        {[false, true].map((mobile) => (
          <svg
            key={String(mobile)}
            className={mobile ? "map-mobile" : "map-desktop"}
            viewBox={mobile ? "0 0 320 330" : "0 0 620 220"}
            role="group"
            aria-label="Условная схема пяти районов, исходные оценки"
          >
            {baseline.districts.map((d) => {
              const shape = (mobile ? mobileShapes : shapes)[d.id];
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
                  <path d={shape.path} />
                  <text x={shape.x} y={shape.y} className="map-name">
                    {d.name}
                  </text>
                  <text x={shape.x} y={shape.y + 24} className="map-score">
                    {format(d.score)}
                  </text>
                  {critical > 0 && (
                    <text
                      x={shape.x}
                      y={shape.y + 44}
                      className="map-critical-text"
                    >
                      {critical}{" "}
                      {critical === 1
                        ? "критический показатель"
                        : critical < 5
                          ? "критических показателя"
                          : "критических показателей"}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        ))}
        <figcaption>Условная схема районов — синтетические данные</figcaption>
      </figure>
    </section>
  );
}
