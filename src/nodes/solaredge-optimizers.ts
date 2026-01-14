import { NodeAPI, NodeMessage, NodeMessageInFlow, Node } from "node-red";
import { SolarEdgeOptimizersConfig } from "../models/types";
import { SolarEdgeApiService } from "../services/solaredge-api.service";
import { InfluxDbUtils } from "../services/influxdb-utils.service";

module.exports = function (RED: NodeAPI) {
  function SolarEdgeOptimizersNode(
    this: any,
    config: SolarEdgeOptimizersConfig
  ) {
    RED.nodes.createNode(this, config);

    this.siteId = config.siteId;
    this.timeUnit = config.timeUnit;
    this.timeZoneSettings = config.timeZoneSettings;
    this.collectAdditionalInfo = config.collectAdditionalInfo;
    this.formatForInfluxDb = config.formatForInfluxDb;
    this.influxDbMeasurement = config.influxDbMeasurement;

    const node = this;

    node.on(
      "input",
      async function (
        msg: NodeMessageInFlow,
        send: (msg: NodeMessage | NodeMessage[]) => void,
        done: (err?: Error) => void
      ) {
        try {
          const apiService = new SolarEdgeApiService(
            node.siteId,
            node.credentials.username,
            node.credentials.password
          );

          // Authenticate with SolarEdge API
          await apiService.login();

          // Fetch optimizer data
          let data = await apiService.getData(
            node.timeUnit,
            node.timeZoneSettings
          );

          // Collect additional information if requested
          if (node.collectAdditionalInfo) {
            const reporterIds = data.map((x) => x.reporterId);
            const tags = await apiService.getTags(node.siteId, reporterIds);

            data = data.map((x) => {
              const currentTags = tags.find(
                (y) => y.reporterId === x.reporterId
              );
              if (currentTags) {
                Object.assign(x, currentTags);
              }
              return x;
            });
          }

          // Format for InfluxDB if requested
          if (node.formatForInfluxDb) {
            const influxData = InfluxDbUtils.convertToInflux(
              data,
              node.influxDbMeasurement
            );
            msg.payload = influxData;
          } else {
            msg.payload = data;
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
      }
    );
  }

  RED.nodes.registerType("solaredge-optimizers", SolarEdgeOptimizersNode, {
    credentials: {
      username: { type: "text" },
      password: { type: "password" },
    },
  });
};
