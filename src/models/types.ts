import { Node, NodeDef } from "node-red";
import {
  BatteryParameter,
  InverterParameter,
  ItemType,
  MeterParameter,
  OptimizerParameter,
  SiteParameter,
  StringParameter,
} from "../services/solaredge-diagram-scraper-service/models/parameters";

export interface SolarEdgeOptimizersConfig extends NodeDef {
  siteId: string;
  timeUnit: "4" | "5";
  timeZoneSettings: "Local" | "UTC";
  collectAdditionalInfo: boolean;
  formatForInfluxDb: boolean;
  influxDbMeasurement: string;
}

export interface SolarEdgeDiagramDataScraperConfig extends NodeDef {
  siteId: string;
  timeZoneSettings: "Local" | "UTC";
  collectLifetimeEnergy: boolean;
  formatForInfluxDb: boolean;
  influxDbMeasurement: string;
  selectedItemTypes?: ItemType[];
  selectedSiteParameters?: SiteParameter[];
  selectedInverterParameters?: InverterParameter[];
  selectedStringParameters?: StringParameter[];
  selectedOptimizerParameters?: OptimizerParameter[];
  selectedMeterParameters?: MeterParameter[];
  selectedBatteryParameters?: BatteryParameter[];
}

export interface SolarEdgeOptimizersNode extends Node {
  siteId: string;
  timeUnit: string;
  timeZoneSettings: "Local" | "UTC";
  collectAdditionalInfo: boolean;
  formatForInfluxDb: boolean;
  influxDbMeasurement: string;
}

export interface SolarEdgeDiagramDataScraperNode extends Node {
  siteId: string;
  timeUnit: string;
  timeZoneSettings: "Local" | "UTC";
  collectLifetimeEnergy: boolean;
  formatForInfluxDb: boolean;
  influxDbMeasurement: string;
  selectedItemTypes: ItemType[];
}

export interface InfluxDbEntry {
  measurement: string;
  fields: Record<string, number | string | boolean>;
  tags: Record<string, string>;
  timestamp: number;
}

export type TimeZoneSettings = "Local" | "UTC";
