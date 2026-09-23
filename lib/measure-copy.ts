import type { Indicator, Measure } from "./types";
// Copy follows the signed effects in the dataset, without inventing outcomes.
const improvements: Record<Indicator, string> = {
  T1: "снижает загруженность дорог",
  T2: "улучшает доступность общественного транспорта",
  E1: "улучшает озеленение",
  E2: "улучшает качество воздуха",
  S1: "улучшает обеспеченность школами и детсадами",
  S2: "улучшает обеспеченность поликлиниками и первичной медпомощью",
  B1: "повышает безопасность улиц",
  B2: "повышает безопасность дорожного движения",
  C1: "повышает надёжность ЖКХ",
  C2: "ускоряет решение обращений жителей",
};
export function measureDescription(measure: Measure) {
  const parts = Object.entries(measure.effects)
    .filter(([, value]) => value > 0)
    .map(([key]) => improvements[key as Indicator]);
  return `В модели ${parts.length > 1 ? parts.slice(0, -1).join(", ") + " и " + parts.at(-1) : parts[0]}.`;
}
