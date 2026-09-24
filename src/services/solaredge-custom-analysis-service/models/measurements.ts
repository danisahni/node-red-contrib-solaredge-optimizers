/**
 * Represents a single measurement data point with timestamp
 */
export interface Measurement {
  time: string; // ISO 8601 timestamp with timezone
  measurement: number | null;
}

/**
 * Device information for the measurement source
 */
export interface Device {
  itemType: string; // e.g., "OPTIMIZER"
  id: string;
  identifier: string;
  connectedToInverter?: string;
  uuid?: string; // required to address STRING items in the generate-chart API
}

/**
 * Complete measurement record including device info and measurement history
 */
export interface MeasurementRecord {
  device: Device;
  measurementType: string; // e.g., "active_power"
  unitType: string; // e.g., "W"
  deviceName: string;
  timeUnitType: string;
  measurements: Measurement[];
}

/**
 * Root type - Array of measurement records
 */
export type Measurements = MeasurementRecord[];
