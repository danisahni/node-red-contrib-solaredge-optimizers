import { NodeAPI, NodeMessage, NodeMessageInFlow } from "node-red";
import { SolarEdgeCustomAnalysisScraperConfig } from "../models/types";
import { InfluxDbUtils } from "../services/influxdb-utils.service";
import { SolarEdgeCustomAnalysisScraperService } from "../services/solaredge-custom-analysis-service/solaredge-custom-analysis-service";
import { ItemType } from "../models";
import {
  AnyParameter,
  MeasurementGranularity,
} from "../services/solaredge-custom-analysis-service/models/parameters";
import {
  MeasurementRequestData,
} from "../services/solaredge-custom-analysis-service/models/measurement-request";
import { Measurements } from "../services/solaredge-custom-analysis-service/models/measurements";

// Reads the optional msg.startDate / msg.endDate (YYYY-MM-DD, UTC). Neither
// set means today; only startDate set means startDate until today.
function parseDateRange(msg: NodeMessageInFlow): {
  startDate?: string;
  endDate?: string;
} {
  const validate = (name: string, value: unknown): string | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    const time =
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? Date.parse(`${value}T00:00:00.000Z`)
        : NaN;
    // the round trip also rejects dates like 2026-02-31
    if (isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value) {
      throw new Error(
        `msg.${name} must be a date in the format YYYY-MM-DD, got "${value}"`,
      );
    }
    return value;
  };
  const startDate = validate("startDate", (msg as any).startDate);
  let endDate = validate("endDate", (msg as any).endDate);
  if (startDate && !endDate) {
    endDate = new Date().toISOString().slice(0, 10);
  }
  if (startDate && endDate && startDate > endDate) {
    throw new Error(
      `msg.startDate (${startDate}) must not be after msg.endDate (${endDate})`,
    );
  }
  return { startDate, endDate };
}

module.exports = function (RED: NodeAPI) {
  function SolarEdgeCustomAnalysisScraperNode(
    this: any,
    config: SolarEdgeCustomAnalysisScraperConfig,
  ) {
    RED.nodes.createNode(this, config);

    this.siteId = config.siteId;
    this.timeZoneSettings = config.timeZoneSettings;
    this.collectLifetimeEnergy = config.collectLifetimeEnergy;
    this.measurementGranularity =
      (config.measurementGranularity as MeasurementGranularity) || "FIVE_MINUTES";
    this.useLegacyParameterNames = config.useLegacyParameterNames || false;
    this.formatForInfluxDb = config.formatForInfluxDb;
    this.influxDbMeasurement = config.influxDbMeasurement;
    this.selectedItemTypes = config.selectedItemTypes || [];
    this.selectedSiteParameters = config.selectedSiteParameters || [];
    this.selectedInverterParameters = config.selectedInverterParameters || [];
    this.selectedStringParameters = config.selectedStringParameters || [];
    this.selectedOptimizerParameters = config.selectedOptimizerParameters || [];
    this.selectedMeterParameters = config.selectedMeterParameters || [];
    this.selectedBatteryParameters = config.selectedBatteryParameters || [];
    const node = this;

    node.on(
      "input",
      async function (
        msg: NodeMessageInFlow,
        send: (msg: NodeMessage | NodeMessage[]) => void,
        done: (err?: Error) => void,
      ) {
        try {
          // optional past date range (UTC calendar days, YYYY-MM-DD)
          const { startDate, endDate } = parseDateRange(msg);
          const scraper = new SolarEdgeCustomAnalysisScraperService(
            node.siteId,
            node.credentials.username,
            node.credentials.password,
          );
          await scraper.login();
          const tree = await scraper.getTree();

          // create measurement types
          const measurementTypes: {
            key: ItemType;
            parameters: AnyParameter[];
          }[] = [
            { key: "SITE", parameters: node.selectedSiteParameters },
            { key: "INVERTER", parameters: node.selectedInverterParameters },
            { key: "STRING", parameters: node.selectedStringParameters },
            { key: "OPTIMIZER", parameters: node.selectedOptimizerParameters },
            { key: "METER", parameters: node.selectedMeterParameters },
            { key: "BATTERY", parameters: node.selectedBatteryParameters },
          ];

          // create measurement request data for all selected item types and parameters
          const measurementRequestData: MeasurementRequestData = [];
          node.selectedItemTypes.forEach(async (t: ItemType) => {
            const currentItems = scraper.extractItemsFromTreeByItemType(t, tree);
            const currentRequestData = scraper.createMeasurementRequestData(
              currentItems,
              measurementTypes,
            );
            measurementRequestData.push(...currentRequestData);
          });

          // get measurements
          const measurements: Measurements = await scraper.getMeasurements(
            measurementRequestData,
            node.measurementGranularity,
            node.useLegacyParameterNames,
            startDate,
            endDate,
          );
          // collect lifetime energy data if selected
          if (node.collectLifetimeEnergy) {
            const lifetimeEnergyMeasurements =
              await scraper.getLifetimeEnergyMeasurements(
                tree,
                node.selectedItemTypes,
                measurements,
                true,
              );
            measurements.push(...lifetimeEnergyMeasurements);
          }
          // convert time to ISO string if UTC is selected
          if (node.timeZoneSettings === "UTC") {
            measurements.forEach((m) => {
              m.measurements.forEach((record) => {
                record.time = new Date(record.time).toISOString();
              });
            });
          }
          // format for InfluxDB if selected
          if (node.formatForInfluxDb && node.influxDbMeasurement) {
            const influxFormattedMeasurements =
              InfluxDbUtils.formatMeasurementsForInfluxDb(
                measurements,
                node.influxDbMeasurement,
              );
            msg.payload = influxFormattedMeasurements;
          } else {
            msg.payload = measurements;
          }

          node.status({ fill: "green", shape: "dot", text: "Success" });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          node.warn(`Error while fetching optimizer data: ${errorMessage}`);
          node.status({ fill: "red", shape: "ring", text: "Error" });
          msg.payload = { error: errorMessage };
        }

        send(msg);
        done();
      },
    );
  }

  RED.nodes.registerType(
    "solaredge-custom-analysis-scraper",
    SolarEdgeCustomAnalysisScraperNode,
    {
      credentials: {
        username: { type: "text" },
        password: { type: "password" },
      },
    },
  );
};
