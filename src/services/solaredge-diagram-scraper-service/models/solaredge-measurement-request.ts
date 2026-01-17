import { ItemType, AnyParameter } from "./parameters";

/**
 * Device identifier for measurement request
 */
export interface MeasurementDevice {
  itemType: ItemType;
  id?: string;
  originalSerial?: string;
  identifier?: string;
  connectedToInverter?: string;
}

/**
 * Single measurement request item for a device
 */
export interface MeasurementRequest {
  device: MeasurementDevice;
  deviceName: string;
  measurementTypes: AnyParameter[];
}

/**
 * Array of measurement requests (POST request body data)
 */
export type MeasurementRequestData = MeasurementRequest[];

/**
 * Helper type for strongly-typed measurement requests per item type
 */
export interface OptimizerMeasurementRequest extends MeasurementRequest {
  device: MeasurementDevice & { itemType: "OPTIMIZER" };
}

export interface InverterMeasurementRequest extends MeasurementRequest {
  device: MeasurementDevice & { itemType: "INVERTER" };
}

export interface StringMeasurementRequest extends MeasurementRequest {
  device: MeasurementDevice & { itemType: "STRING" };
}

export interface MeterMeasurementRequest extends MeasurementRequest {
  device: MeasurementDevice & { itemType: "METER" };
}

export interface BatteryMeasurementRequest extends MeasurementRequest {
  device: MeasurementDevice & { itemType: "BATTERY" };
}

export interface SiteMeasurementRequest extends MeasurementRequest {
  device: MeasurementDevice & { itemType: "SITE" };
}

/**
 * Union type for all measurement request types
 */
export type TypedMeasurementRequest =
  | OptimizerMeasurementRequest
  | InverterMeasurementRequest
  | StringMeasurementRequest
  | MeterMeasurementRequest
  | BatteryMeasurementRequest
  | SiteMeasurementRequest;
