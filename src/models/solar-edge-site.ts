import { SolarEdgeInverter } from "./solar-edge-inverter";
import { SolarEdgeOptimizer } from "./solar-edge-optimizer";

export class SolarEdgeSite {
  siteId: string;
  inverters: SolarEdgeInverter[];

  constructor(jsonObj: any) {
    this.siteId = jsonObj.siteId;
    this.inverters = this.extractInverters(jsonObj);
  }

  private extractInverters(jsonObj: any): SolarEdgeInverter[] {
    const inverters: SolarEdgeInverter[] = [];

    for (let i = 0; i < jsonObj.logicalTree.childIds.length; i++) {
      // Check for production meter
      if (
        !jsonObj.logicalTree.children[i].data.name
          .toUpperCase()
          .includes("PRODUCTION METER")
      ) {
        inverters.push(new SolarEdgeInverter(jsonObj, i));
      } else {
        for (
          let j = 0;
          j < jsonObj.logicalTree.children[i].childIds.length;
          j++
        ) {
          inverters.push(new SolarEdgeInverter(jsonObj, i, j, true));
        }
      }
    }

    return inverters;
  }

  get optimizers(): SolarEdgeOptimizer[] {
    const optimizers: SolarEdgeOptimizer[] = [];
    for (const inverter of this.inverters) {
      for (const string of inverter.strings) {
        for (const optimizer of string.optimizers) {
          optimizers.push(optimizer);
        }
      }
    }
    return optimizers;
  }
}
