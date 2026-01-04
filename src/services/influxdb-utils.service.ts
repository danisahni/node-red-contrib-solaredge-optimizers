import { OptimizerData, InfluxDbEntry } from "../models/types";

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
}
