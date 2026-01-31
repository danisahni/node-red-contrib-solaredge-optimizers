/** SolarEdge Optimizers TypeScript Module - Clean Version matching Python original */

import axios from "axios";
import type { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { Cookie, CookieJar } from "tough-cookie";
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
import { LifetimeEnergyResponse } from "./models/lifetime-energy-response";
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

  createLifetimeEnergyMeasurements(
    lifetimeEnergy: LifetimeEnergyResponse,
    logicalLayout: LogicalLayoutResponse,
    selectedItemTypes: ItemType[],
    measurements?: Measurements,
    addToNearestTimestamp: boolean = true,
  ): Measurements {
    const itemTypeMapping: { [key: string]: ItemType } = {
      INVERTER_1PHASE: "INVERTER",
      INVERTER_3PHASE: "INVERTER",
      STRING: "STRING",
      POWER_BOX: "OPTIMIZER",
    };

    // flatten logical layout
    const nodes: LogicalTreeNodeData[] = [];
    const traverseNodes = (node: LogicalTreeNode) => {
      if (
        node.data &&
        selectedItemTypes.includes(itemTypeMapping[node.data.type] || "UNKNOWN")
      ) {
        nodes.push(node.data);
      }
      if (node.children.length > 0) {
        node.children.forEach((child) => traverseNodes(child));
      }
    };

    traverseNodes(logicalLayout.logicalTree);

    const lifetimeEnergyIds = Object.keys(lifetimeEnergy);
    const lifetimeEnergyMeasurements: Measurements = [];

    const time = this.formatDateWithTimezone(new Date());

    lifetimeEnergyIds.forEach((reporterId) => {
      const node = nodes.find((n) => n.id.toString() === reporterId);
      if (!node) return;
      const value = lifetimeEnergy[reporterId].unscaledEnergy;
      if (value === null || value === undefined) return;
      let measurementRecord: MeasurementRecord | undefined;
      if (node.type === "STRING") {
        // find measurement record by name (as blueprint)
        measurementRecord = measurements?.find(
          (mr) => mr.deviceName === node.name,
        );
      } else {
        // find measurement record with same serial number (as blueprint)
        measurementRecord = measurements?.find(
          (mr) => mr.device.id === node.serialNumber,
        );
      }
      let lifetimeEnergyMeasurementRecord: MeasurementRecord | undefined;
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
            timestamp = this.formatDateWithTimezone(now);
          }
        }

        lifetimeEnergyMeasurementRecord = JSON.parse(
          JSON.stringify(measurementRecord),
        ) as MeasurementRecord;
        lifetimeEnergyMeasurementRecord.measurementType = "LIFETIME_ENERGY";
        lifetimeEnergyMeasurementRecord.unitType = "WH";
        lifetimeEnergyMeasurementRecord.timeUnitType = "";
        lifetimeEnergyMeasurementRecord.measurements = [
          {
            time: timestamp || time,
            measurement: value,
          },
        ];
      } else {
        // use data from logical layout to create measurement record
        lifetimeEnergyMeasurementRecord = {
          device: {
            itemType: itemTypeMapping[node.type] || "UNKNOWN",
            id: node.serialNumber || "",
            identifier: node.serialNumber?.split("-")[0] || "",
            // connectedToInverter: "",
          },
          measurementType: "LIFETIME_ENERGY",
          unitType: "WH",
          deviceName: node.name,
          timeUnitType: "",
          measurements: [
            {
              time: time,
              measurement: value,
            },
          ],
        };
      }
      lifetimeEnergyMeasurements.push(lifetimeEnergyMeasurementRecord);
    });
    return lifetimeEnergyMeasurements;
  }

  formatDateWithTimezone(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    // Timezone offset in Minuten (z. B. -60 für +01:00)
    const tzOffsetMin = -date.getTimezoneOffset();
    const sign = tzOffsetMin >= 0 ? "+" : "-";

    const tzHours = pad(Math.floor(Math.abs(tzOffsetMin) / 60));
    const tzMinutes = pad(Math.abs(tzOffsetMin) % 60);

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${tzHours}:${tzMinutes}`;
  }
}
