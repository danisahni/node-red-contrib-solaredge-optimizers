import { OptimizerData, InfluxDbEntry } from "../models/types";
import { Measurements } from "./solaredge-diagram-scraper-service/models/measurements";

export class InfluxDbUtils {
  static convertToInflux(
    data: OptimizerData[],
    measurement: string
  ): InfluxDbEntry[] {
    const influxData: InfluxDbEntry[] = [];

    data.forEach((item) => {
      // Extract tags by removing the 'data' property
      const { data: itemData, ...tags } = item;

      itemData.forEach((entry) => {
        const influxEntry: InfluxDbEntry = {
          measurement,
          fields: {
            power: entry.value,
          },
          tags,
          timestamp: Date.parse(entry.timestamp), // unix timestamp
        };
        influxData.push(influxEntry);
      });
    });

    return influxData;
  }

  static formatMeasurementsForInfluxDb(
    measurements: Measurements,
    influxMeasurementName: string
  ): InfluxDbEntry[] {
    // Group by device and timestamp
    const groupedData = new Map<
      string,
      Map<
        number,
        { fields: Record<string, number>; tags: Record<string, string> }
      >
    >();

    measurements.forEach((record) => {
      // Create unique device key
      const deviceKey = `${record.device.itemType}_${
        record.device.id || record.device.identifier || record.deviceName
      }`;

      // Extract tags from device info (without measurementType)
      const tags: Record<string, string> = {
        itemType: record.device.itemType,
        deviceName: record.deviceName,
        timeUnitType: record.timeUnitType,
      };

      // Add device-specific tags if present
      if (record.device.id) tags.deviceId = record.device.id;
      if (record.device.identifier) tags.identifier = record.device.identifier;
      if (record.device.originalSerial)
        tags.serialNumber = record.device.originalSerial;
      if (record.device.connectedToInverter)
        tags.connectedToInverter = record.device.connectedToInverter;

      // Process each measurement point
      record.measurements.forEach((point) => {
        // Skip null measurements
        if (point.measurement === null) return;

        const timestamp = new Date(point.time).getTime();

        // Get or create device group
        if (!groupedData.has(deviceKey)) {
          groupedData.set(deviceKey, new Map());
        }
        const deviceGroup = groupedData.get(deviceKey)!;

        // Get or create timestamp entry
        if (!deviceGroup.has(timestamp)) {
          deviceGroup.set(timestamp, { fields: {}, tags: { ...tags } });
        }
        const entry = deviceGroup.get(timestamp)!;

        // Add measurement as field (use measurementType as field name)
        entry.fields[record.measurementType] = point.measurement;
      });
    });

    // Convert grouped data to InfluxDB entries
    const influxData: InfluxDbEntry[] = [];
    groupedData.forEach((deviceGroup) => {
      deviceGroup.forEach((entry, timestamp) => {
        influxData.push({
          measurement: influxMeasurementName,
          fields: entry.fields,
          tags: entry.tags,
          timestamp: timestamp,
        });
      });
    });

    return influxData;
  }
}
