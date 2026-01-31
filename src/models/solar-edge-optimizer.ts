export class SolarEdgeOptimizer {
  optimizerId: string;
  serialNumber: string;
  name: string;
  displayName: string;
  relativeOrder: number;
  type: string;
  operationsKey: string;

  constructor(jsonObj: any) {
    this.optimizerId = jsonObj.data.id;
    this.serialNumber = jsonObj.data.serialNumber;
    this.name = jsonObj.data.name;
    this.displayName = jsonObj.data.displayName;
    this.relativeOrder = jsonObj.data.relativeOrder;
    this.type = jsonObj.data.type;
    this.operationsKey = jsonObj.data.operationsKey;
  }
}
