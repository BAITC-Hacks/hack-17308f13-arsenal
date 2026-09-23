export type Indicator =
  "T1" | "T2" | "E1" | "E2" | "S1" | "S2" | "B1" | "B2" | "C1" | "C2";
export type Direction =
  "transport" | "ecology" | "social" | "safety" | "services";
export type Indicators = Record<Indicator, number>;
export interface District {
  id: string;
  name: string;
  populationShare: number;
  description: string;
  indicators: Indicators;
}
export interface Measure {
  id: string;
  direction: Direction;
  name: string;
  scope: "city" | "district";
  cost: number;
  lag: number;
  effects: Partial<Indicators>;
}
export interface Decision {
  measureId: string;
  districtId?: string;
}
