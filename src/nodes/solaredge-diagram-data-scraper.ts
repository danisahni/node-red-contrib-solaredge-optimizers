import { NodeAPI, NodeMessage, NodeMessageInFlow, Node } from "node-red";
import { SolarEdgeDiagramDataScraperConfig } from "../models/types";
import { InfluxDbUtils } from "../services/influxdb-utils.service";
import { SolarEdgeDiagramScraperService } from "../services/solaredge-diagram-scraper-service/solaredege-diagram-scraper-service";
import { AnyParameter, ItemType, MeasurementRequestData } from "../models";
import { Measurements } from "../services/solaredge-diagram-scraper-service/models/measurements";

module.exports = function (RED: NodeAPI) {
  function SolarEdgeDiagramDataScraperNode(
    this: any,
    config: SolarEdgeDiagramDataScraperConfig,
  ) {
    RED.nodes.createNode(this, config);

    this.siteId = config.siteId;
    this.timeZoneSettings = config.timeZoneSettings;
    this.collectLifetimeEnergy = config.collectLifetimeEnergy;
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
          const scraper = new SolarEdgeDiagramScraperService(
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
            {
              key: "SITE",
              parameters: node.selectedSiteParameters,
            },
            {
              key: "INVERTER",
              parameters: node.selectedInverterParameters,
            },
            {
              key: "STRING",
              parameters: node.selectedStringParameters,
            },
            {
              key: "OPTIMIZER",
              parameters: node.selectedOptimizerParameters,
            },
            {
              key: "METER",
              parameters: node.selectedMeterParameters,
            },
            {
              key: "BATTERY",
              parameters: node.selectedBatteryParameters,
            },
          ];

          // create measurement request data for all selected item types and parameters
          const measurementRequestData: MeasurementRequestData = [];
          node.selectedItemTypes.forEach(async (t: ItemType) => {
            const currentItems = scraper.extractItemsFromTreeByItemType(
              t,
              tree,
            );
            const currentRequestData = scraper.createMeasurementRequestData(
              currentItems,
              measurementTypes,
            );
            measurementRequestData.push(...currentRequestData);
          });

          // get measurements
          const measurements: Measurements = await scraper.getMeasurements(
            measurementRequestData,
          );
          // collect lifetime energy data if selected
          if (node.collectLifetimeEnergy) {
            const logicalLayout = await scraper.getLogicalLayout();
            const lifetimeEnergy = await scraper.getLifetimeEnergy();
            const mappedLifetimeEnergy =
              scraper.mapLifetimeEnergyIdsAndSerialNumbers(
                lifetimeEnergy,
                logicalLayout,
              );
            const lifetimeEnergyMeasurements =
              scraper.createLifetimeEnergyMeasurements(
                mappedLifetimeEnergy,
                measurements,
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
    "solaredge-diagram-data-scraper",
    SolarEdgeDiagramDataScraperNode,
    {
      credentials: {
        username: { type: "text" },
        password: { type: "password" },
      },
    },
  );
};
