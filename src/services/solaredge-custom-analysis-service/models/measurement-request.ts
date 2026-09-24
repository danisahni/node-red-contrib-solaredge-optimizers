import { ItemType } from "../../solaredge-diagram-scraper-service/models/parameters";
import { AnyParameter } from "./parameters";

export interface MeasurementDevice {
  itemType: ItemType;
  id?: string;
  identifier?: string;
  connectedToInverter?: string;
  uuid?: string; // required to address STRING items in the generate-chart API
}

export interface MeasurementRequest {
  device: MeasurementDevice;
  deviceName: string;
  measurementTypes: AnyParameter[];
}

export type MeasurementRequestData = MeasurementRequest[];
