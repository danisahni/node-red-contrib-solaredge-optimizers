import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import {
  OptimizerData,
  OptimizerTag,
  SolaredgeApiResponse,
  LoginCredentials,
  TimeUnit,
  TimeZoneSettings,
} from "../models/types";

const LOGIN_URL = "https://monitoring.solaredge.com/solaredge-apigw/api/login";
const DATA_URL =
  "https://monitoring.solaredge.com/solaredge-web/p/playbackData";
const DETAILS_URL =
  "https://monitoring.solaredge.com/solaredge-web/p/systemData";

export class SolaredgeApiService {
  private client: AxiosInstance;
  private csrfToken?: string;

  constructor() {
    this.client = this.createClientWithCookieJar();
  }

  private createClientWithCookieJar(): AxiosInstance {
    const jar = new CookieJar();
    return wrapper(axios.create({ jar }));
  }

  async login(credentials: LoginCredentials): Promise<string | undefined> {
    try {
      const params = new URLSearchParams();
      params.append("j_username", credentials.username);
      params.append("j_password", credentials.password);

      const response = await this.client.post(LOGIN_URL, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      this.csrfToken = response.headers["x-csrf-token"];
      return this.csrfToken;
    } catch (error) {
      console.error("Login failed:", error);
      throw new Error("Failed to authenticate with SolarEdge API");
    }
  }

  async getData(
    siteId: string,
    timeUnit: TimeUnit,
    timeZoneSettings: TimeZoneSettings
  ): Promise<OptimizerData[]> {
    if (!this.csrfToken) {
      throw new Error("Not authenticated. Please login first.");
    }

    try {
      const params = new URLSearchParams();
      params.append("fieldId", siteId);
      params.append("timeUnit", timeUnit);

      const response = await this.client.post(DATA_URL, params, {
        headers: {
          "X-CSRF-TOKEN": this.csrfToken,
        },
      });

      return this.cleanUpData(response.data, timeZoneSettings);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      throw new Error("Failed to fetch optimizer data from SolarEdge API");
    }
  }

  async getTags(
    siteId: string,
    reporterIds: string[]
  ): Promise<OptimizerTag[]> {
    if (!this.csrfToken) {
      throw new Error("Not authenticated. Please login first.");
    }

    const tags: OptimizerTag[] = [];

    await Promise.all(
      reporterIds.map(async (id) => {
        const params = new URLSearchParams();
        params.append("fieldId", siteId);
        params.append("reporterId", id);
        params.append("type", "any");
        params.append("activeTab", "0");
        params.append("isPublic", "false");

        try {
          const response = await this.client.post(DETAILS_URL, params, {
            headers: {
              "X-CSRF-TOKEN": this.csrfToken,
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

    const jsonData: SolaredgeApiResponse = JSON.parse(text);
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
}
