import { Node, NodeDef } from "node-red";

export interface SolaredgeOptimizersConfig extends NodeDef {
  siteId: string;
  timeUnit: string;
  timeZoneSettings: "Local" | "GMT";
  collectAdditionalInfo: boolean;
  formatForInfluxDb: boolean;
  influxDbMeasurement: string;
}

export interface SolarEdgeDiagramDataScraperConfig extends NodeDef {
  siteId: string;
  timeUnit: string;
  timeZoneSettings: "Local" | "GMT";
  collectAdditionalInfo: boolean;
  formatForInfluxDb: boolean;
  influxDbMeasurement: string;
  selectedItemTypes?: { [key: string]: boolean };
}

export interface SolaredgeOptimizersNode extends Node {
  siteId: string;
  timeUnit: string;
  timeZoneSettings: "Local" | "GMT";
  collectAdditionalInfo: boolean;
  formatForInfluxDb: boolean;
  influxDbMeasurement: string;
}

export interface SolarEdgeDiagramDataScraperNode extends Node {
  siteId: string;
  timeUnit: string;
  timeZoneSettings: "Local" | "GMT";
  collectAdditionalInfo: boolean;
  formatForInfluxDb: boolean;
  influxDbMeasurement: string;
  selectedItemTypes: { [key: string]: boolean };
  itemTypes: string[];
}

export interface OptimizerDataPoint {
  timestamp: string;
  value: number;
}

export interface OptimizerData {
  reporterId: string;
  data: OptimizerDataPoint[];
  serialNumber?: string;
  type?: string;
  description?: string;
  manufacturer?: string;
}

export interface OptimizerTag {
  reporterId: string;
  serialNumber?: string;
  type?: string;
  description?: string;
  manufacturer?: string;
}

export interface InfluxDbEntry {
  measurement: string;
  fields: {
    power: number;
  };
  tags: Omit<OptimizerData, "data">;
  timestamp: number;
}

export interface SolaredgeApiResponse {
  reportersData: {
    [dateString: string]: {
      [sid: string]: Array<{
        key: string;
        value: string;
      }>;
    };
  };
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export type TimeUnit =
  | "QUARTER_OF_AN_HOUR"
  | "HOUR"
  | "DAY"
  | "WEEK"
  | "MONTH"
  | "YEAR";
export type TimeZoneSettings = "Local" | "GMT";
