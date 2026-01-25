/** SolarEdge Optimizers TypeScript Module - Clean Version matching Python original */

import axios from "axios";
import type { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { Cookie, CookieJar } from "tough-cookie";
import fs from "fs";
import {
  AnyParameter,
  ItemType,
  MeasurementRequest,
  MeasurementRequestData,
  SiteNode,
  SolarEdgeTree,
  TreeItem,
} from "../../models";
import {
  Measurement,
  MeasurementRecord,
  Measurements,
} from "./models/measurements";
import {
  LifetimeEnergyResponse,
  MappedLifetimeEnergyEntry,
} from "./models/lifetime-energy-response";
import {
  LogicalLayoutResponse,
  LogicalTreeNode,
  LogicalTreeNodeData,
} from "./models/logical-layout-response";

export class SolarEdgeDiagramScraperService {
  private siteId: string;
  private username: string;
  private password: string;
  private api: AxiosInstance;

  constructor(siteid: string, username: string, password: string) {
    this.siteId = siteid;
    this.username = username;
    this.password = password;

    // Create axios instance with cookie jar support
    const jar = new CookieJar();
    this.api = wrapper(axios.create({ jar }));

    // Set default headers
    this.api.defaults.headers.common["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36";
    this.api.defaults.headers.common["Accept"] = "application/json";
  }

  async login(): Promise<void> {
    try {
      const url = "https://monitoring.solaredge.com/solaredge-apigw/api/login";
      const params = new URLSearchParams();
      params.append("j_username", this.username);
      params.append("j_password", this.password);
      const response = await this.api.post(url, params);
      if (response.status !== 200) {
        throw new Error(`Login failed: HTTP ${response.status} `);
      }
      this.api.defaults.headers.common["X-CSRF-TOKEN"] =
        response.headers["x-csrf-token"];
      await this.bootstrapSession();
    } catch (error: any) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  private async bootstrapSession(): Promise<void> {
    try {
      const url = `https://monitoring.solaredge.com/solaredge-web/p/chartParamsList?fieldId=${this.siteId}`;
      await this.api.get(url);
    } catch (error: any) {
      throw new Error(`bootstrapSession failed: ${error.message}`);
    }
  }

  async getTree(): Promise<SolarEdgeTree> {
    const url = `https://monitoring.solaredge.com/services/charts/site/${this.siteId}/tree`;
    const response = await this.api.get(url);
    return response.data as SolarEdgeTree;
  }

  extractItemsFromTreeByItemType(
    itemType: ItemType,
    tree: SolarEdgeTree,
  ): TreeItem[] {
    switch (itemType) {
      case "METER":
        return tree.meters || [];
      case "BATTERY":
        return tree.storage?.children || [];
      case "SITE":
      case "INVERTER":
      case "STRING":
      case "OPTIMIZER":
        return this.extractSiteNodesByItemType(itemType, tree.siteStructure);
      default:
        return [];
    }
  }

  extractSiteNodesByItemType(
    itemType: ItemType,
    siteNode: SiteNode,
  ): SiteNode[] {
    const result: SiteNode[] = [];
    if (siteNode.itemId.itemType == itemType) {
      if (itemType === "STRING" && siteNode.children === null) return result; // ignore STRINGS without children (not active)
      result.push(siteNode);
    }
    siteNode.children?.forEach((child) => {
      const childResults = this.extractSiteNodesByItemType(itemType, child);
      result.push(...childResults);
    });
    return result;
  }

  createMeasurementRequestData(
    items: TreeItem[],
    measurementTypes: { key: ItemType; parameters: AnyParameter[] }[],
  ): MeasurementRequestData {
    const data: MeasurementRequestData = [];
    items.forEach((item) => {
      const index = measurementTypes.findIndex(
        (mt) => mt.key === item.itemId.itemType,
      );
      let currentMeasurementTypes: AnyParameter[] = [];
      if (index !== -1) {
        currentMeasurementTypes = measurementTypes[index].parameters;
      } else {
        return; // skip this item
      }

      const device = {
        itemType: item.itemId.itemType,
        id: item.itemId.id,
        identifier: item.itemId.identifier,
        connectedToInverter: item.itemId.connectedToInverter,
      };
      const deviceName = item.name || "";

      const request: MeasurementRequest = {
        device,
        deviceName,
        measurementTypes: currentMeasurementTypes,
      };
      data.push(request);
    });
    return data;
  }

  async getMeasurements(
    requestedMeasurements: MeasurementRequestData,
    startDate?: string,
    endDate?: string,
  ): Promise<Measurements> {
    try {
      if (!startDate && !endDate) {
        const today = new Date();
        // const yesterday = new Date(today);
        // yesterday.setDate(today.getDate() - 1);
        endDate = today.toISOString().slice(0, 10);
        // startDate = yesterday.toISOString().slice(0, 10);
        startDate = endDate;
      } else if (!startDate) {
        startDate = endDate;
      } else {
        endDate = startDate;
      }
      const url = `https://monitoring.solaredge.com/services/charts/site/${this.siteId}/devices-measurements?start-date=${startDate}&end-date=${endDate}`;
      const response = await this.api.post(url, requestedMeasurements);
      return response.data as Measurements;
    } catch (error: any) {
      throw new Error(`getMeasurements failed: ${error.message}`);
    }
  }

  async getLifetimeEnergy(): Promise<LifetimeEnergyResponse> {
    try {
      const url = `https://monitoring.solaredge.com/solaredge-apigw/api/sites/${this.siteId}/layout/energy?timeUnit=ALL`;
      const response = await this.api.post(
        url,
        {},
        {
          headers: { "Content-Type": "application/json" },
        },
      );
      return response.data as LifetimeEnergyResponse;
    } catch (error: any) {
      throw new Error(`getLifetimeEnergy failed: ${error.message}`);
    }
  }

  async getLogicalLayout(): Promise<LogicalLayoutResponse> {
    try {
      const url = `https://monitoring.solaredge.com/solaredge-apigw/api/sites/${this.siteId}/layout/logical`;
      const response = await this.api.get(url);
      return response.data as LogicalLayoutResponse;
    } catch (error: any) {
      throw new Error(`getLogicalLayout failed: ${error.message}`);
    }
  }

  mapLifetimeEnergyIdsAndSerialNumbers(
    lifetimeEnergy: LifetimeEnergyResponse,
    logicalLayout: LogicalLayoutResponse,
  ): MappedLifetimeEnergyEntry[] {
    // flatten logical layout
    const nodes: LogicalTreeNodeData[] = [];
    const traverseNodes = (node: LogicalTreeNode) => {
      if (node.data) {
        nodes.push(node.data);
      }
      if (node.children.length > 0) {
        node.children.forEach((child) => traverseNodes(child));
      }
    };

    traverseNodes(logicalLayout.logicalTree);

    const lifetimeEnergyIds = Object.keys(lifetimeEnergy);
    const lifetimeEnergyMapped: MappedLifetimeEnergyEntry[] = [];

    lifetimeEnergyIds.forEach((reporterId) => {
      const node = nodes.find((n) => n.id.toString() === reporterId);
      if (node) {
        lifetimeEnergyMapped.push({
          id: reporterId,
          serialNumber: node.serialNumber,
          lifetimeEnergy: lifetimeEnergy[reporterId].unscaledEnergy,
        });
      }
    });
    return lifetimeEnergyMapped;
  }

  createLifetimeEnergyMeasurements(
    mappedLifetimeEnergy: MappedLifetimeEnergyEntry[],
    measurements: Measurements,
    addToNearestTimestamp: boolean = true,
  ): Measurements {
    const now = new Date();
    const lifetimeEnergyMeasurements: Measurements = [];
    mappedLifetimeEnergy.forEach((le) => {
      // find measurment record with same serial number (as blueprint)
      const measurementRecord = measurements.find(
        (mr) => mr.device.id === le.serialNumber,
      );
      if (measurementRecord) {
        let timestamp: string = "";
        if (addToNearestTimestamp) {
          let best: Measurement | undefined;
          let bestDiff = Infinity;
          const now = new Date();
          // assuming measurements are sorted by time ascending
          for (const m of measurementRecord.measurements) {
            const t = new Date(m.time).getTime();
            if (t > now.getTime()) break;
            const diff = Math.abs(now.getTime() - t);
            if (diff < bestDiff) {
              best = m;
              bestDiff = diff;
            }
          }
          // 15 Minuten in ms
          const FIFTEEN_MINUTES = 15 * 60 * 1000;
          if (best && bestDiff <= FIFTEEN_MINUTES) {
            timestamp = best.time;
          } else {
            timestamp = now.toISOString();
          }
        }

        const lifetimeEnergyMeasurementRecord = JSON.parse(
          JSON.stringify(measurementRecord),
        ) as MeasurementRecord;
        lifetimeEnergyMeasurementRecord.measurementType = "LifetimeEnergy";
        lifetimeEnergyMeasurementRecord.unitType = "Wh";
        lifetimeEnergyMeasurementRecord.measurements = [
          {
            time: timestamp || now.toISOString(),
            measurement: le.lifetimeEnergy,
          },
        ];
        lifetimeEnergyMeasurements.push(lifetimeEnergyMeasurementRecord);
      }
    });
    return lifetimeEnergyMeasurements;
  }
}
