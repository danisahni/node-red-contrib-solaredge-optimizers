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
}

/**
 * Complete measurement record including device info and measurement history
 */
export interface MeasurementRecord {
  device: Device;
  measurementType: string; // e.g., "OPTIMIZER_OUTPUT_VOLTAGE"
  unitType: string; // e.g., "V"
  deviceName: string;
  timeUnitType: string; // e.g., "QUARTER_OF_AN_HOUR"
  measurements: Measurement[];
}

/**
 * Root type - Array of measurement records
 */
export type Measurements = MeasurementRecord[];
