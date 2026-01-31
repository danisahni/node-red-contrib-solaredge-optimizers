export interface CellularConnectionProperties {
  connectionType: string;
  connectionFailure: string | null;
  connectable: boolean;
}

export interface LifetimeEnergyEntry {
  energy: number;
  moduleEnergy: number;
  unscaledEnergy: number;
  units: string;
  color: string;
  groupColor: string;
  relayState: any; // null oder ggf. genauerer Typ, falls bekannt
  cellularConnectionProperties: CellularConnectionProperties | null;
}

export type LifetimeEnergyResponse = Record<string, LifetimeEnergyEntry>;
