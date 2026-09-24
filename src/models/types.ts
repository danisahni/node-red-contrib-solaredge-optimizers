import { NodeDef } from "node-red";
import {
  BatteryParameter,
  InverterParameter,
  ItemType,
  MeterParameter,
  OptimizerParameter,
  SiteParameter,
  StringParameter,
} from "../services/solaredge-diagram-scraper-service/models/parameters";
import {
  BatteryParameter as CustomAnalysisBatteryParameter,
  InverterParameter as CustomAnalysisInverterParameter,
  MeasurementGranularity,
  MeterParameter as CustomAnalysisMeterParameter,
  OptimizerParameter as CustomAnalysisOptimizerParameter,
  SiteParameter as CustomAnalysisSiteParameter,
  StringParameter as CustomAnalysisStringParameter,
} from "../services/solaredge-custom-analysis-service/models/parameters";

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

export interface SolarEdgeCustomAnalysisScraperConfig extends NodeDef {
  siteId: string;
  timeZoneSettings: "Local" | "UTC";
  collectLifetimeEnergy: boolean;
  measurementGranularity?: MeasurementGranularity;
  useLegacyParameterNames?: boolean;
  formatForInfluxDb: boolean;
  influxDbMeasurement: string;
  selectedItemTypes?: ItemType[];
  selectedSiteParameters?: CustomAnalysisSiteParameter[];
  selectedInverterParameters?: CustomAnalysisInverterParameter[];
  selectedStringParameters?: CustomAnalysisStringParameter[];
  selectedOptimizerParameters?: CustomAnalysisOptimizerParameter[];
  selectedMeterParameters?: CustomAnalysisMeterParameter[];
  selectedBatteryParameters?: CustomAnalysisBatteryParameter[];
}

export interface InfluxDbEntry {
  measurement: string;
  fields: Record<string, number | string | boolean>;
  tags: Record<string, string>;
  timestamp: number;
}

export type TimeZoneSettings = "Local" | "UTC";
