import { ItemType, AnyParameter } from "./parameters";

/**
 * Device identifier for measurement request
 */
export interface MeasurementDevice {
  itemType: ItemType;
  id?: string;
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
