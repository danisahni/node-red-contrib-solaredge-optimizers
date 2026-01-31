import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import {
  OptimizerData,
  OptimizerTag,
  SolarEdgeApiResponse,
  TimeUnit,
  TimeZoneSettings,
} from "../models/types";

const LOGIN_URL = "https://monitoring.solaredge.com/solaredge-apigw/api/login";
const DATA_URL =
  "https://monitoring.solaredge.com/solaredge-web/p/playbackData";
const DETAILS_URL =
  "https://monitoring.solaredge.com/solaredge-web/p/systemData";

export class SolarEdgeApiService {
  private siteId: string;
  private username: string;
  private password: string;
  private api: AxiosInstance;
  private x_csrf_token: string | undefined;

  constructor(siteId: string, username: string, password: string) {
    this.siteId = siteId;
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
      const params = new URLSearchParams();
      params.append("j_username", this.username);
      params.append("j_password", this.password);

      const response = await this.api.post(LOGIN_URL, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      this.x_csrf_token = response.headers["x-csrf-token"];
    } catch (error) {
      console.error("Login failed:", error);
      throw new Error("Failed to authenticate with SolarEdge API");
    }
  }

  async getData(
    timeUnit: "4" | "5",
    timeZoneSettings: TimeZoneSettings
  ): Promise<OptimizerData[]> {
    if (!this.x_csrf_token) {
      throw new Error("Not authenticated. Please login first.");
    }

    try {
      const params = new URLSearchParams();
      params.append("fieldId", this.siteId);
      params.append("timeUnit", timeUnit);

      const response = await this.api.post(DATA_URL, params, {
        headers: {
          "X-CSRF-TOKEN": this.x_csrf_token,
        },
      });

      return this.cleanUpData(response.data, timeZoneSettings);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      throw new Error("Failed to fetch optimizer data from SolarEdge API");
    }
  }

  async getTags(reporterIds: string[]): Promise<OptimizerTag[]> {
    if (!this.x_csrf_token) {
      throw new Error("Not authenticated. Please login first.");
    }

    const tags: OptimizerTag[] = [];

    await Promise.all(
      reporterIds.map(async (id) => {
        const params = new URLSearchParams();
        params.append("fieldId", this.siteId);
        params.append("reporterId", id);
        params.append("type", "any");
        params.append("activeTab", "0");
        params.append("isPublic", "false");

        try {
          const response = await this.api.post(DETAILS_URL, params, {
            headers: {
              "X-CSRF-TOKEN": this.x_csrf_token,
            },
          });

          const text = response.data.split("=")[1].split(";")[0];
          const infoData = JSON.parse(text);
          infoData.reporterId = id;

          const tagsToExtract = [
            "reporterId",
            "serialNumber",
            "type",
            "description",
            "manufacturer",
          ] as const;

          const currentTags = tagsToExtract.reduce((prev, curr) => {
            prev[curr] = infoData[curr];
            return prev;
          }, {} as Record<string, any>) as OptimizerTag;

          tags.push(currentTags);
        } catch (error) {
          console.error(`Failed to fetch tags for reporter ${id}:`, error);
        }
      })
    );

    return tags;
  }

  private cleanUpData(
    text: string,
    timeZoneSettings: TimeZoneSettings
  ): OptimizerData[] {
    // Clean up the response text to make it valid JSON
    text = text.replaceAll("'", '"');
    text = text
      .replaceAll("Array", "")
      .replaceAll("key", '"key"')
      .replaceAll("value", '"value"');
    text = text
      .replaceAll("timeUnit", '"timeUnit"')
      .replaceAll("fieldData", '"fieldData"')
      .replaceAll("reportersData", '"reportersData"');

    const jsonData: SolarEdgeApiResponse = JSON.parse(text);
    const data: OptimizerData[] = [];
    const regex = /GMT([+-]\d{4})/;
    const localGMT = new Date().toString().match(regex)?.[0] || "GMT+0000";

    for (const dateString of Object.keys(jsonData.reportersData)) {
      const localDateString =
        timeZoneSettings === "Local"
          ? dateString.replace("GMT", localGMT)
          : dateString;
      const date = new Date(localDateString);

      for (const sid of Object.keys(jsonData.reportersData[dateString])) {
        for (const entry of Object.values(
          jsonData.reportersData[dateString][sid]
        )) {
          let index = data.findIndex((x) => x.reporterId === entry.key);
          if (index === -1) {
            data.push({ reporterId: entry.key, data: [] });
            index = data.length - 1;
          }

          const value = Number.parseFloat(entry.value.replaceAll(",", ""));
          data[index].data.push({ timestamp: date.toISOString(), value });
        }
      }
    }

    return data;
  }
  async addAdditionalInfo(data: OptimizerData[]): Promise<OptimizerData[]> {
    const reporterIds = data.map((x) => x.reporterId);
    const tags = await this.getTags(reporterIds);

    const updatedData = data.map((x) => {
      const currentTags = tags.find((y) => y.reporterId === x.reporterId);
      if (currentTags) {
        Object.assign(x, currentTags);
      }
      return x;
    });
    return updatedData;
  }
}
