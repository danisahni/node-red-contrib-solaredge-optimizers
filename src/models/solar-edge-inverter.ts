import { SolarEdgeString } from "./solar-edge-string";

export class SolarEdgeInverter {
  inverterId: string;
  serialNumber: string;
  name: string;
  displayName: string;
  relativeOrder: number;
  type: string;
  operationsKey: string;
  strings: SolarEdgeString[];

  constructor(
    jsonObj: any,
    index: number,
    index2: number = 0,
    powerMeterPresent: boolean = false
  ) {
    const data = powerMeterPresent
      ? jsonObj.logicalTree.children[index].children[index2].data
      : jsonObj.logicalTree.children[index].data;

    this.inverterId = data.id;
    this.serialNumber = data.serialNumber;
    this.name = data.name;
    this.displayName = data.displayName;
    this.relativeOrder = data.relativeOrder;
    this.type = data.type;
    this.operationsKey = data.operationsKey;

    const children = powerMeterPresent
      ? jsonObj.logicalTree.children[index].children[index2].children
      : jsonObj.logicalTree.children[index].children;

    this.strings = this.extractStrings(children);
  }

  private extractStrings(children: any[]): SolarEdgeString[] {
    const strings: SolarEdgeString[] = [];

    for (const child of children) {
      if (child.data.name.toUpperCase().includes("STRING")) {
        strings.push(new SolarEdgeString(child));
      } else {
        for (const subChild of child.children || []) {
          strings.push(new SolarEdgeString(subChild));
        }
      }
    }

    return strings;
  }
}
