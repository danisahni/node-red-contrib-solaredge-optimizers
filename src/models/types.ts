import { Node, NodeDef } from "node-red";
import {
  BatteryParameter,
  InverterParameter,
  ItemType,
  WeatherParameter,
  MeterParameter,
  OptimizerParameter,
  SiteParameter,
  StringParameter,
} from "../services/solaredge-diagram-scraper-service/models/parameters";

export interface SolarEdgeOptimizersConfig extends NodeDef {
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
  selectedItemTypes?: ItemType[];
  selectedSiteParameters?: SiteParameter[];
  selectedInverterParameters?: InverterParameter[];
  selectedStringParameters?: StringParameter[];
  selectedOptimizerParameters?: OptimizerParameter[];
  selectedMeterParameters?: MeterParameter[];
  selectedBatteryParameters?: BatteryParameter[];
  selectedMeteorologicalParameters?: WeatherParameter[];
}

export interface SolarEdgeOptimizersNode extends Node {
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
  selectedItemTypes: ItemType[];
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

export interface SolarEdgeApiResponse {
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
