import axios from "axios";
import type { AxiosInstance } from "axios";
import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";
import {
  ItemType,
  SiteNode,
  SolarEdgeTree,
  TreeItem,
} from "../../models";
import {
  AnyParameter,
  BATTERY_PARAMETERS,
  INVERTER_PARAMETERS,
  LEGACY_PARAMETER_ALIASES,
  MeasurementGranularity,
  METER_PARAMETERS,
  OPTIMIZER_PARAMETERS,
  SITE_PARAMETERS,
  STRING_PARAMETERS,
} from "./models/parameters";
import {
  MeasurementDevice,
  MeasurementRequest,
  MeasurementRequestData,
} from "./models/measurement-request";
import {
  Measurement,
  MeasurementRecord,
  Measurements,
} from "./models/measurements";

// Same SolarEdge ONE / Cognito login and site tree as
// SolarEdgeDiagramScraperService - duplicated rather than inherited because
// the two services' measurement request/response types are genuinely
// different catalogs (see models/parameters.ts) and don't override cleanly.
const COGNITO_USER_POOL_ID = "eu-central-1_fVUTz39em";
const COGNITO_CLIENT_ID = "ugfnsujd3384sshcjehaphlh3";

/**
 * Fetches measurements from SolarEdge's newer "Custom Analysis" API
 * (/services/cni/ui-api/.../generate-chart), which - unlike the legacy
 * /services/charts/.../devices-measurements endpoint used by
 * SolarEdgeDiagramScraperService - supports a configurable resolution
 * (5 minutes / 15 minutes / 1 hour / 1 day). The trade-off is a completely
 * different metric-naming scheme; see models/parameters.ts for the verified
 * mapping between the old and new names.
 */
export class SolarEdgeCustomAnalysisScraperService {
  private siteId: string;
  private username: string;
  private password: string;
  private api: AxiosInstance;

  constructor(siteid: string, username: string, password: string) {
    this.siteId = siteid;
    this.username = username;
    this.password = password;

    this.api = axios.create();
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

  private extractSiteNodesByItemType(
    itemType: ItemType,
    siteNode: SiteNode,
  ): SiteNode[] {
    const result: SiteNode[] = [];
    if (siteNode.itemId.itemType == itemType) {
      if (itemType === "STRING" && siteNode.children === null) return result;
      result.push(siteNode);
    }
    siteNode.children?.forEach((child) => {
      result.push(...this.extractSiteNodesByItemType(itemType, child));
    });
    return result;
  }

  private static readonly VALID_PARAMETERS: Record<ItemType, Set<string>> = {
    SITE: new Set(SITE_PARAMETERS),
    INVERTER: new Set(INVERTER_PARAMETERS),
    STRING: new Set(STRING_PARAMETERS),
    OPTIMIZER: new Set(OPTIMIZER_PARAMETERS),
    METER: new Set(METER_PARAMETERS),
    BATTERY: new Set(BATTERY_PARAMETERS),
  };

  // "Legacy Parameter Names" lets a flow migrating from
  // solaredge-diagram-data-scraper keep using its old parameter selections
  // and old InfluxDB field names - old names are translated to the real
  // metric on the way in, and (when enabled) translated back on the way out.
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
        const itemType = item.itemId.itemType;
        const validParameters =
          SolarEdgeCustomAnalysisScraperService.VALID_PARAMETERS[itemType];
        const legacyAliases = LEGACY_PARAMETER_ALIASES[itemType] || {};
        const requested = measurementTypes[index].parameters;
        const unknown: string[] = [];
        currentMeasurementTypes = requested
          .map((p) => {
            if (validParameters.has(p)) return p;
            const aliased = legacyAliases[p];
            if (aliased) return aliased as AnyParameter;
            unknown.push(p);
            return null;
          })
          .filter((p): p is AnyParameter => p !== null);
        if (unknown.length > 0) {
          console.warn(
            `Ignoring unknown ${itemType} parameter(s): ${unknown.join(", ")} - these names don't match this catalog and have no known legacy equivalent.`,
          );
        }
      } else {
        return; // skip this item
      }

      const device: MeasurementDevice = {
        itemType: item.itemId.itemType,
        id: item.itemId.id,
        identifier: item.itemId.identifier,
        connectedToInverter: item.itemId.connectedToInverter,
        uuid: item.uuid,
      };
      const deviceName = item.name || "";

      data.push({ device, deviceName, measurementTypes: currentMeasurementTypes });
    });
    return data;
  }

  // SITE is reported via a "calculation" metric under category
  // "exported_imported_energy", INVERTER/OPTIMIZER/METER/BATTERY(->STORAGE)
  // via "measurement" metrics (INVERTER's power/energy_since_last_telemetry
  // live under category "pv_measurements" rather than the default
  // "measurements"), and STRING via a "calculation" metric under
  // "optimizer_calculations" addressed by the tree node's uuid instead of
  // its itemId.id/identifier.
  private static readonly METRIC_SPEC: Record<
    ItemType,
    { metricType: "measurement" | "calculation"; category: string } | null
  > = {
    SITE: { metricType: "calculation", category: "exported_imported_energy" },
    INVERTER: { metricType: "measurement", category: "measurements" },
    STRING: { metricType: "calculation", category: "optimizer_calculations" },
    OPTIMIZER: { metricType: "measurement", category: "measurements" },
    METER: { metricType: "measurement", category: "measurements" },
    BATTERY: { metricType: "measurement", category: "measurements" },
  };

  private static readonly CATEGORY_OVERRIDES: Partial<
    Record<ItemType, Record<string, string>>
  > = {
    INVERTER: {
      power: "pv_measurements",
      energy_since_last_telemetry: "pv_measurements",
    },
  };

  // ItemType/tree naming stays BATTERY throughout this project (matching
  // the site tree response); SolarEdge's generate-chart API calls the same
  // device type STORAGE.
  private static readonly DEVICE_TYPE: Partial<Record<ItemType, string>> = {
    INVERTER: "INVERTER",
    STRING: "STRING",
    OPTIMIZER: "OPTIMIZER",
    METER: "METER",
    BATTERY: "STORAGE",
  };

  // Reverse of LEGACY_PARAMETER_ALIASES (new metric name -> old parameter
  // name).
  private static readonly LEGACY_PARAMETER_NAME_BY_METRIC: Partial<
    Record<ItemType, Record<string, string>>
  > = Object.fromEntries(
    Object.entries(LEGACY_PARAMETER_ALIASES).map(([itemType, aliases]) => [
      itemType,
      Object.fromEntries(
        Object.entries(aliases as Record<string, string>).map(
          ([oldName, newName]) => [newName, oldName],
        ),
      ),
    ]),
  );

  async getMeasurements(
    requestedMeasurements: MeasurementRequestData,
    granularity: MeasurementGranularity = "FIVE_MINUTES",
    useLegacyParameterNames: boolean = false,
    startDate?: string,
    endDate?: string,
  ): Promise<Measurements> {
    if (!startDate && !endDate) {
      const today = new Date();
      endDate = today.toISOString().slice(0, 10);
      startDate = endDate;
    } else if (!startDate) {
      startDate = endDate;
    } else {
      endDate = startDate;
    }
    if (requestedMeasurements.length === 0) return [];

    // Group by itemType, then by metric category within that itemType,
    // since one datasource can only carry one shared metrics list.
    type DatasourceGroup = {
      itemType: ItemType;
      metricType: "measurement" | "calculation";
      category: string;
      parameters: Set<string>;
      requests: MeasurementRequest[];
    };
    const groups = new Map<string, DatasourceGroup>();

    for (const request of requestedMeasurements) {
      const itemType = request.device.itemType;
      const spec = SolarEdgeCustomAnalysisScraperService.METRIC_SPEC[itemType];
      if (!spec) continue; // no known generate-chart mapping for this type

      for (const parameter of request.measurementTypes) {
        const category =
          SolarEdgeCustomAnalysisScraperService.CATEGORY_OVERRIDES[itemType]?.[
            parameter
          ] ?? spec.category;
        const key = `${itemType}:${spec.metricType}:${category}`;
        let group = groups.get(key);
        if (!group) {
          group = {
            itemType,
            metricType: spec.metricType,
            category,
            parameters: new Set(),
            requests: [],
          };
          groups.set(key, group);
        }
        group.parameters.add(parameter);
        if (!group.requests.includes(request)) group.requests.push(request);
      }
    }

    if (groups.size === 0) return [];

    const from = `${startDate}T00:00:00.000Z`;
    const to = `${endDate}T23:59:59.999Z`;

    const datasources = Array.from(groups.values()).map((group) => {
      const metrics = Array.from(group.parameters).map((uri) =>
        group.metricType === "measurement"
          ? { metricType: "measurement", metricsCategoryName: group.category, uri }
          : {
              metricType: "calculation",
              calculationCategoryUri: group.category,
              periodType: granularity,
              calculationMetricUri: uri,
            },
      );

      const datasourcePopulation =
        group.itemType === "SITE"
          ? { siteId: Number(this.siteId), populationType: "site" }
          : {
              populationType: "deviceList",
              siteId: Number(this.siteId),
              deviceType: SolarEdgeCustomAnalysisScraperService.DEVICE_TYPE[
                group.itemType
              ],
              deviceSerials: group.requests.map((r) =>
                group.itemType === "STRING"
                  ? (r.device.uuid ?? r.device.id)
                  : (r.device.identifier || r.device.id),
              ),
            };

      return {
        metrics,
        datasourcePopulation,
        alignmentGranularity: granularity,
        group,
      };
    });

    const url = `https://monitoring.solaredge.com/services/cni/ui-api/pages/site/analysis/custom/site/${this.siteId}/generate-chart`;
    let response;
    try {
      response = await this.api.post(url, {
        reportPeriod: { from, to },
        datasources: datasources.map(({ group, ...d }) => d),
      });
    } catch (error: any) {
      throw new Error(`getMeasurements failed: ${error.message}`);
    }

    return this.parseResponse(response.data, datasources, useLegacyParameterNames);
  }

  private parseResponse(
    data: {
      meta: {
        datasetsMeta: {
          reportObject: { entityType: string; entityId: string };
          metrics: { uri: string; units?: string }[];
        }[];
      };
      data: [string, ...(number | null)[]][][];
    },
    datasources: {
      group: { itemType: ItemType; requests: MeasurementRequest[] };
    }[],
    useLegacyParameterNames: boolean,
  ): Measurements {
    const measurements: Measurements = [];
    let datasetIndex = 0;

    for (const { group } of datasources) {
      // Each datasource contributes one datasetMeta/data entry per device
      // in that datasource's population (SITE contributes exactly one).
      const deviceCount = group.itemType === "SITE" ? 1 : group.requests.length;
      for (let i = 0; i < deviceCount; i++) {
        const datasetMeta = data.meta.datasetsMeta[datasetIndex];
        const points = data.data[datasetIndex];
        datasetIndex++;
        if (!datasetMeta || !points) continue;

        const request =
          group.itemType === "SITE"
            ? group.requests[0]
            : group.requests.find(
                (r) =>
                  r.device.identifier === datasetMeta.reportObject.entityId ||
                  r.device.id === datasetMeta.reportObject.entityId ||
                  r.device.uuid === datasetMeta.reportObject.entityId,
              );
        if (!request) continue;

        datasetMeta.metrics.forEach((metric, metricIndex) => {
          const columnIndex = metricIndex + 1; // column 0 is the timestamp
          const legacyName = useLegacyParameterNames
            ? SolarEdgeCustomAnalysisScraperService.LEGACY_PARAMETER_NAME_BY_METRIC[
                group.itemType
              ]?.[metric.uri]
            : undefined;
          measurements.push({
            device: {
              itemType: request.device.itemType,
              id: request.device.id || request.device.identifier || "",
              identifier: request.device.identifier || request.device.id || "",
              connectedToInverter: request.device.connectedToInverter,
              uuid: request.device.uuid,
            },
            measurementType: legacyName ?? metric.uri,
            unitType: metric.units || "",
            deviceName: request.deviceName,
            timeUnitType: "",
            measurements: points.map((point) => ({
              time: point[0],
              measurement: (point[columnIndex] as number | null) ?? null,
            })),
          });
        });
      }
    }

    return measurements;
  }

  // SolarEdge retired the old bulk `apigw/.../layout/energy` (all reporterIds
  // in one call) and `apigw/.../layout/logical` (reporterId -> serial mapping)
  // endpoints. The /services/layout/* replacements report lifetime energy
  // per device instead, so this issues one request per SITE/INVERTER/
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
    } of SolarEdgeCustomAnalysisScraperService.LIFETIME_ENERGY_DEVICE_TYPES) {
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

    const tzOffsetMin = -date.getTimezoneOffset();
    const sign = tzOffsetMin >= 0 ? "+" : "-";

    const tzHours = pad(Math.floor(Math.abs(tzOffsetMin) / 60));
    const tzMinutes = pad(Math.abs(tzOffsetMin) % 60);

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${tzHours}:${tzMinutes}`;
  }
}
