import { NodeAPI, NodeMessage, NodeMessageInFlow, Node } from "node-red";
import { SolarEdgeOptimizersConfig } from "../models/types";

const DEPRECATION_MESSAGE =
  "The 'solaredge-optimizers' node is deprecated and no longer works: SolarEdge retired " +
  "the API endpoints it relied on. Please replace it with the 'solaredge-diagram-data-scraper' " +
  "node (select 'OPTIMIZER' under Types) - see the README for migration details.";

module.exports = function (RED: NodeAPI) {
  function SolarEdgeOptimizersNode(
    this: any,
    config: SolarEdgeOptimizersConfig,
  ) {
    RED.nodes.createNode(this, config);

    this.siteId = config.siteId;

    const node = this;

    node.on(
      "input",
      async function (
        msg: NodeMessageInFlow,
        send: (msg: NodeMessage | NodeMessage[]) => void,
        done: (err?: Error) => void,
      ) {
        node.warn(DEPRECATION_MESSAGE);
        node.status({ fill: "red", shape: "ring", text: "Deprecated" });
        msg.payload = { error: DEPRECATION_MESSAGE };

        send(msg);
        done();
      },
    );
  }

  RED.nodes.registerType("solaredge-optimizers", SolarEdgeOptimizersNode, {
    credentials: {
      username: { type: "text" },
      password: { type: "password" },
    },
  });
};
