/** SolarEdge Optimizers TypeScript Module - Clean Version matching Python original */

import axios from "axios";
import type { AxiosInstance } from "axios";
import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";
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

// SolarEdge ONE authenticates through this AWS Cognito user pool; the old
// Spring-Security-based `j_username`/`j_password` login no longer grants
// access to the /services/* JSON APIs (they now require a Cognito access
// token), even though it still works for the legacy solaredge-web/p/* pages.
const COGNITO_USER_POOL_ID = "eu-central-1_fVUTz39em";
const COGNITO_CLIENT_ID = "ugfnsujd3384sshcjehaphlh3";

export class SolarEdgeDiagramScraperService {
  protected siteId: string;
  private username: string;
  private password: string;
  protected api: AxiosInstance;

  constructor(siteid: string, username: string, password: string) {
    this.siteId = siteid;
    this.username = username;
    this.password = password;

    this.api = axios.create();

    // Set default headers
    this.api.defaults.headers.common["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36";
    this.api.defaults.headers.common["Accept"] = "application/json";
  }

  async login(): Promise<void> {
    try {
      const userPool = new CognitoUserPool({
        UserPoolId: COGNITO_USER_POOL_ID,
        ClientId: COGNITO_CLIENT_ID,
      });
      const cognitoUser = new CognitoUser({
        Username: this.username,
        Pool: userPool,
      });
      const authDetails = new AuthenticationDetails({
        Username: this.username,
        Password: this.password,
      });

      const accessToken = await new Promise<string>((resolve, reject) => {
        cognitoUser.authenticateUser(authDetails, {
          onSuccess: (result) => resolve(result.getAccessToken().getJwtToken()),
          onFailure: (error) => reject(error),
        });
      });

      const payload = JSON.parse(
        Buffer.from(accessToken.split(".")[1], "base64").toString("utf-8"),
      );
      const userId = payload.uuid;

      this.api.defaults.headers.common["Cookie"] =
        `se_monitoring_auth=${accessToken}`;
      this.api.defaults.headers.common["X-SE-User-ID"] = userId;
    } catch (error: any) {
      throw new Error(`Login failed: ${error.message}`);
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

  /**
   * Fetches the requested measurements for the calendar days
   * startDate..endDate (inclusive, YYYY-MM-DD, in the site's time zone).
   * Defaults to today if neither is given; if only one is given, only that
   * day is fetched.
   *
   * devices-measurements picks a coarser resolution the longer the range is
   * (e.g. inverter: 5 minutes for one day, 15 minutes for a few days, 1 hour
   * for two weeks), so ranges are fetched one day per request to keep the
   * same resolution as a regular single-day run.
   */
  async getMeasurements(
    requestedMeasurements: MeasurementRequestData,
    startDate?: string,
    endDate?: string,
  ): Promise<Measurements> {
    if (!startDate && !endDate) {
      startDate = endDate = new Date().toISOString().slice(0, 10);
    } else if (!startDate) {
      startDate = endDate;
    } else if (!endDate) {
      endDate = startDate;
    }

    const DAY_MS = 24 * 60 * 60 * 1000;
    const end = Date.parse(`${endDate}T00:00:00.000Z`);
    const merged: Measurements = [];
    const recordsByKey = new Map<string, MeasurementRecord>();
    for (
      let current = Date.parse(`${startDate}T00:00:00.000Z`);
      current <= end;
      current += DAY_MS
    ) {
      const date = new Date(current).toISOString().slice(0, 10);
      for (const record of await this.getMeasurementsForDay(
        requestedMeasurements,
        date,
      )) {
        const key = `${record.device.itemType}:${record.device.id}:${record.device.identifier}:${record.measurementType}`;
        const existing = recordsByKey.get(key);
        if (existing) {
          existing.measurements.push(...record.measurements);
        } else {
          recordsByKey.set(key, record);
          merged.push(record);
        }
      }
    }
    return merged;
  }

  private async getMeasurementsForDay(
    requestedMeasurements: MeasurementRequestData,
    date: string,
  ): Promise<Measurements> {
    try {
      const url = `https://monitoring.solaredge.com/services/charts/site/${this.siteId}/devices-measurements?start-date=${date}&end-date=${date}`;
      const response = await this.api.post(url, requestedMeasurements);
      return response.data as Measurements;
    } catch (error: any) {
      // e.g. {"error":{"code":"DATASET_TOO_LARGE",...}} for data older than
      // SolarEdge keeps
      const details = error.response?.data?.error;
      const reason = details
        ? `${details.code}: ${details.description}`
        : error.message;
      throw new Error(`getMeasurements failed for ${date}: ${reason}`);
    }
  }

  // SolarEdge retired the old bulk `apigw/.../layout/energy` (all reporterIds
  // in one call) and `apigw/.../layout/logical` (reporterId -> serial mapping)
  // endpoints. The /services/layout/* replacements report lifetime energy
  // per device instead, so this now issues one request per SITE/INVERTER/
  // OPTIMIZER item; no reporterId -> serial mapping is needed any more since
  // the tree already carries real serial numbers. STRING, METER and BATTERY
  // have no known per-device lifetime-energy endpoint yet, so they're skipped.
  private static readonly LIFETIME_ENERGY_DEVICE_TYPES: {
    itemType: ItemType;
    urlSegment: string;
    serialParam: string;
  }[] = [
    { itemType: "INVERTER", urlSegment: "inverters", serialParam: "inverter-serials" },
    { itemType: "OPTIMIZER", urlSegment: "optimizers", serialParam: "optimizer-serials" },
  ];

  private async getSiteLifetimeEnergy(
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const url =
      `https://monitoring.solaredge.com/services/layout/energy/site/${this.siteId}` +
      `?chart-time-unit=years&start-date=${startDate}&end-date=${endDate}&measurement-types=production`;
    const response = await this.api.get(url);
    return response.data.energy as number;
  }

  private async getDeviceLifetimeEnergy(
    urlSegment: string,
    serialParam: string,
    serial: string,
    startDate: string,
    endDate: string,
  ): Promise<number | null> {
    const url =
      `https://monitoring.solaredge.com/services/layout/energy-graph/site/${this.siteId}/${urlSegment}` +
      `?chart-time-unit=years&start-date=${startDate}&end-date=${endDate}&${serialParam}=${encodeURIComponent(serial)}`;
    const response = await this.api.get(url);
    return response.data.totalEnergy ?? null;
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;
    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      async () => {
        while (nextIndex < items.length) {
          const current = nextIndex++;
          results[current] = await fn(items[current]);
        }
      },
    );
    await Promise.all(workers);
    return results;
  }

  private findNearestTimestamp(
    record: MeasurementRecord | undefined,
    fallback: string,
    addToNearestTimestamp: boolean,
  ): string {
    if (!addToNearestTimestamp || !record) return fallback;
    let best: Measurement | undefined;
    let bestDiff = Infinity;
    const now = new Date();
    // assuming measurements are sorted by time ascending
    for (const m of record.measurements) {
      const t = new Date(m.time).getTime();
      if (t > now.getTime()) break;
      const diff = Math.abs(now.getTime() - t);
      if (diff < bestDiff) {
        best = m;
        bestDiff = diff;
      }
    }
    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    return best && bestDiff <= FIFTEEN_MINUTES ? best.time : fallback;
  }

  async getLifetimeEnergyMeasurements(
    tree: SolarEdgeTree,
    selectedItemTypes: ItemType[],
    measurements?: Measurements,
    addToNearestTimestamp: boolean = true,
  ): Promise<Measurements> {
    if (!tree.installationDate) {
      throw new Error(
        "getLifetimeEnergyMeasurements failed: tree has no installationDate",
      );
    }
    const startDate = tree.installationDate.slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);
    const fallbackTime = this.formatDateWithTimezone(new Date());

    const lifetimeEnergyMeasurements: Measurements = [];

    if (selectedItemTypes.includes("SITE")) {
      const energy = await this.getSiteLifetimeEnergy(startDate, endDate);
      const blueprint = measurements?.find((mr) => mr.device.itemType === "SITE");
      lifetimeEnergyMeasurements.push({
        device: { itemType: "SITE", id: this.siteId, identifier: this.siteId },
        measurementType: "LIFETIME_ENERGY",
        unitType: "WH",
        deviceName: tree.siteStructure.name || "",
        timeUnitType: "",
        measurements: [
          {
            time: this.findNearestTimestamp(blueprint, fallbackTime, addToNearestTimestamp),
            measurement: energy,
          },
        ],
      });
    }

    for (const {
      itemType,
      urlSegment,
      serialParam,
    } of SolarEdgeDiagramScraperService.LIFETIME_ENERGY_DEVICE_TYPES) {
      if (!selectedItemTypes.includes(itemType)) continue;
      const items = this.extractItemsFromTreeByItemType(itemType, tree);
      const results = await this.mapWithConcurrency(
        items,
        8,
        async (item): Promise<MeasurementRecord | null> => {
          if (!item.itemId.id) return null;
          const energy = await this.getDeviceLifetimeEnergy(
            urlSegment,
            serialParam,
            item.itemId.id,
            startDate,
            endDate,
          );
          if (energy === null) return null;
          const blueprint = measurements?.find(
            (mr) => mr.device.id === item.itemId.id,
          );
          return {
            device: {
              itemType,
              id: item.itemId.id,
              identifier: item.itemId.identifier || "",
              connectedToInverter: item.itemId.connectedToInverter,
            },
            measurementType: "LIFETIME_ENERGY",
            unitType: "WH",
            deviceName: item.name || "",
            timeUnitType: "",
            measurements: [
              {
                time: this.findNearestTimestamp(blueprint, fallbackTime, addToNearestTimestamp),
                measurement: energy,
              },
            ],
          };
        },
      );
      lifetimeEnergyMeasurements.push(
        ...results.filter((r): r is MeasurementRecord => r !== null),
      );
    }

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
