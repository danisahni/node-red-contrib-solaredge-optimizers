import { SolarEdgeOptimizer } from "./solar-edge-optimizer";

export class SolarEdgeString {
  stringId: string;
  serialNumber: string;
  name: string;
  displayName: string;
  relativeOrder: number;
  type: string;
  operationsKey: string;
  optimizers: SolarEdgeOptimizer[];

  constructor(jsonObj: any) {
    this.stringId = jsonObj.data.id;
    this.serialNumber = jsonObj.data.serialNumber;
    this.name = jsonObj.data.name;
    this.displayName = jsonObj.data.displayName;
    this.relativeOrder = jsonObj.data.relativeOrder;
    this.type = jsonObj.data.type;
    this.operationsKey = jsonObj.data.operationsKey;
    this.optimizers = this.extractOptimizers(jsonObj);
  }

  private extractOptimizers(jsonObj: any): SolarEdgeOptimizer[] {
    const optimizers: SolarEdgeOptimizer[] = [];

    for (const child of jsonObj.children || []) {
      optimizers.push(new SolarEdgeOptimizer(child));
    }

    return optimizers;
  }
}
