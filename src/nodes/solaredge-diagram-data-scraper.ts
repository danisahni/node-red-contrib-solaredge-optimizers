import { NodeAPI, NodeMessage, NodeMessageInFlow, Node } from "node-red";
import { SolarEdgeDiagramDataScraperConfig } from "../models/types";
import { SolarEdgeApiService } from "../services/solaredge-api.service";
import { InfluxDbUtils } from "../services/influxdb-utils.service";
import { SolarEdgeDiagramScraperService } from "../services/solaredge-diagram-scraper-service/solaredege-diagram-scraper-service";
import {
  AnyParameter,
  ItemType,
  MeasurementRequestData,
  SiteNode,
} from "../models";
import { Measurements } from "../services/solaredge-diagram-scraper-service/models/measurements";

module.exports = function (RED: NodeAPI) {
  function SolarEdgeDiagramDataScraperNode(
    this: any,
    config: SolarEdgeDiagramDataScraperConfig
  ) {
    RED.nodes.createNode(this, config);

    this.siteId = config.siteId;
    this.timeZoneSettings = config.timeZoneSettings;
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
        done: (err?: Error) => void
      ) {
        try {
          const scraper = new SolarEdgeDiagramScraperService(
            node.siteId,
            node.credentials.username,
            node.credentials.password
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

          // create data for get measurements
          const measurementRequestData: MeasurementRequestData = [];
          node.selectedItemTypes.forEach(async (t: ItemType) => {
            const currentItems = scraper.extractItemsFromTreeByItemType(
              t,
              tree
            );
            const currentRequestData = scraper.createMeasurementRequestData(
              currentItems,
              measurementTypes
            );
            measurementRequestData.push(...currentRequestData);
          });
          const measurements: Measurements = await scraper.getMeasurements(
            measurementRequestData
          );
          console.log(measurements.length);

          msg.payload = {
            selectedItemTypes: node.selectedItemTypes,
            selectedSiteParameters: node.selectedSiteParameters,
            selectedInverterParameters: node.selectedInverterParameters,
            selectedStringParameters: node.selectedStringParameters,
            selectedOptimizerParameters: node.selectedOptimizerParameters,
            selectedMeterParameters: node.selectedMeterParameters,
            selectedBatteryParameters: node.selectedBatteryParameters,
            measurements: measurements,
          };
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
      }
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
    }
  );
};
