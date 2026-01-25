/** SolarEdge Optimizers TypeScript Module - Clean Version matching Python original */

import axios from "axios";
import type { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

import { SolarEdgeSite, SolarEdgeOptimizerData } from "../models";

interface ChartDataResponse {
  dateValuePairs: Array<{ date: number; value: number }>;
}

export class SolarEdgeOptimizerScraperService {
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

    // Set default Basic Auth for all requests
    this.api.defaults.auth = {
      username: this.username,
      password: this.password,
    };

    // Set default headers
    this.api.defaults.headers.common["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36";
    this.api.defaults.headers.common["Accept"] = "application/json";
  }

  async login(): Promise<void> {
    let x_csrf_token = undefined;
    try {
      const url = "https://monitoring.solaredge.com/solaredge-apigw/api/login";
      const params = new URLSearchParams();
      params.append("j_username", this.username);
      params.append("j_password", this.password);
      let response = await this.api.post(url, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      x_csrf_token = response.headers["x-csrf-token"];
      this.api.defaults.headers.common["X-CSRF-TOKEN"] = x_csrf_token;
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * Extract JSON object from a string (similar to Python jsonfinder)
   * Looks for patterns like "SE.systemData = {...};"
   */
  private extractJsonFromString(text: string): any | null {
    try {
      // Look for SE.systemData = {...}; pattern
      const systemDataMatch = text.match(/SE\.systemData\s*=\s*(\{[^;]*\});/);
      if (systemDataMatch) {
        const jsonString = systemDataMatch[1];
        return JSON.parse(jsonString);
      }

      // Fallback: Look for any JSON object in the string
      const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Alternative: More comprehensive JSON extraction
      const jsonMatches = text.match(/\{(?:[^{}]|\{[^{}]*\})*\}/g);
      if (jsonMatches && jsonMatches.length > 0) {
        // Try to parse each match, return the first valid JSON
        for (const match of jsonMatches) {
          try {
            return JSON.parse(match);
          } catch (e) {
            continue; // Try next match
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error extracting JSON from string:", error);
      return null;
    }
  }

  /**
   * Decode result from API response (mimics Python version)
   */
  private decodeResult(result: any): any {
    if (typeof result === "string") {
      // First try to extract SE.systemData JSON
      const extractedJson = this.extractJsonFromString(result);
      if (extractedJson) {
        return extractedJson;
      }

      // Fallback: try to parse the whole string as JSON
      try {
        return JSON.parse(result);
      } catch (error) {
        console.warn("Could not parse result as JSON:", error);
        return result;
      }
    }
    return result;
  }

  async requestSolarEdgeSite(): Promise<SolarEdgeSite> {
    const url = `https://monitoring.solaredge.com/solaredge-apigw/api/sites/${this.siteId}/layout/logical`;
    const response = await this.api.get(url);
    return new SolarEdgeSite(response.data);
  }

  async requestSystemData(
    itemId: string,
  ): Promise<SolarEdgeOptimizerData | null> {
    const url = `https://monitoringpublic.solaredge.com/solaredge-web/p/publicSystemData?reporterId=${itemId}&type=panel&activeTab=0&fieldId=${this.siteId}&isPublic=true&locale=en_US`;

    try {
      const response = await this.api.get(url);

      if (response.status === 200) {
        const jsonObject = this.decodeResult(response.data);
        try {
          if (jsonObject.lastMeasurementDate === "") {
            console.log(`Skipping optimizer ${itemId} without measurements`);
            return null;
          } else {
            return new SolarEdgeOptimizerData(itemId, jsonObject);
          }
        } catch (error) {
          console.error("Error while processing data", error);
          throw new Error("Error while processing data");
        }
      } else {
        console.error(
          `Error with sending request. Status code: ${response.status}`,
        );
        console.error(response.data);
        throw new Error(
          `Problem sending request, status code ${response.status}: ${response.data}`,
        );
      }
    } catch (error: any) {
      console.error("Request failed:", error);
      throw new Error(
        `Problem sending request, status code ${
          error.response?.status || 500
        }: ${error.response?.data || error.message}`,
      );
    }
  }

  /**
   * Get lifetime energy data using authenticated API
   */
  async getLifeTimeEnergy(): Promise<any> {
    try {
      const url = `https://monitoring.solaredge.com/solaredge-apigw/api/sites/${this.siteId}/layout/energy?timeUnit=ALL`;
      const response = await this.api.post(
        url,
        {},
        {
          headers: { "Content-Type": "application/json" },
        },
      );
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async requestAllData(): Promise<SolarEdgeOptimizerData[]> {
    const solarSite = await this.requestSolarEdgeSite();
    const lifeTimeEnergy = await this.getLifeTimeEnergy();

    // Collect all optimizer IDs first
    const optimizerTasks: Array<{
      optimizerId: string;
      promise: Promise<SolarEdgeOptimizerData | null>;
    }> = solarSite.optimizers.map((opt) => ({
      optimizerId: opt.optimizerId,
      promise: this.requestSystemData(opt.optimizerId),
    }));

    // Execute all requests in parallel
    const results = await Promise.allSettled(
      optimizerTasks.map((task) => task.promise),
    );

    // Process results
    const data: SolarEdgeOptimizerData[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const optimizerId = optimizerTasks[i].optimizerId;

      if (result.status === "fulfilled" && result.value !== null) {
        const info = result.value;
        // Life time energy adding
        if (lifeTimeEnergy[optimizerId]) {
          info.lifetime_energy =
            parseFloat(lifeTimeEnergy[optimizerId].unscaledEnergy) / 1000;
        }
        data.push(info);
      } else if (result.status === "rejected") {
        console.warn(
          `⚠️ Failed to fetch data for optimizer ${optimizerId}:`,
          result.reason,
        );
      }
    }
    return data;
  }

  async requestItemHistory(
    itemId: string,
    starttime?: Date | number | null,
    endtime?: Date | number | null,
    parameter: string = "Power",
  ): Promise<{ [date: string]: number }> {
    let starttimeMs: number;
    let endtimeMs: number;

    if (endtime === null || endtime === undefined) {
      endtimeMs = new Date().getTime();
    } else if (endtime instanceof Date) {
      endtimeMs = endtime.getTime();
    } else {
      endtimeMs = endtime;
    }

    if (starttime === null || starttime === undefined) {
      // const now = new Date();
      // const startOfDay = new Date(
      //   now.getFullYear(),
      //   now.getMonth(),
      //   now.getDate()
      // );
      // starttimeMs = startOfDay.getTime();
      starttimeMs = endtimeMs - 24 * 60 * 60 * 1000; // Default to last 24 hours
    } else if (starttime instanceof Date) {
      starttimeMs = starttime.getTime();
    } else {
      starttimeMs = starttime;
    }

    const url = `https://monitoring.solaredge.com/solaredge-web/p/chartData?reporterId=${itemId}&fieldId=${this.siteId}&reporterType=&startDate=${starttimeMs}&endDate=${endtimeMs}&uom=W&parameterName=${parameter}`;

    // Use authenticated request with cooldown and retry logic
    const response = await this.api.get(url);

    if (response.status != 200) {
      throw new Error(`Error while doing request: ${response.data}`);
    }

    const jsonObject: ChartDataResponse = this.decodeResult(response.data);

    const historyData: { [date: string]: number } = {};
    try {
      // Note: the timestamp provided by SolarEdge contains timezone offset (like Python version)
      for (const pair of jsonObject.dateValuePairs) {
        const date = new Date(pair.date).toISOString();
        historyData[date] = pair.value;
      }
    } catch (error) {
      throw new Error("Error while processing data");
    }
    return historyData;
  }
}
