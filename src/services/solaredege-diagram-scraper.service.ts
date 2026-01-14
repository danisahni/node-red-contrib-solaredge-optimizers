/** SolarEdge Optimizers TypeScript Module - Clean Version matching Python original */

import axios from "axios";
import type { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { Cookie, CookieJar } from "tough-cookie";
import fs from "fs";
import {
  ItemId,
  ItemType,
  MeasurementRequestData,
  SiteNode,
  SolarEdgeResponse,
} from "../models";

export class SolarEdgeDiagramScraper {
  private siteId: string;
  private username: string;
  private password: string;
  private api: AxiosInstance;
  private x_csrf_token: string | undefined;

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
      const response = await this.api.post(url, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      if (response.status !== 200) {
        throw new Error("Login failed: HTTP " + response.status);
      }

      this.x_csrf_token = response.headers["x-csrf-token"];

      await this.bootstrapSession();
    } catch (error: any) {
      throw new Error(`login fehlgeschlagen: ${error.message}`);
    }
  }

  private async bootstrapSession(): Promise<void> {
    try {
      await this.api.get(
        `https://monitoring.solaredge.com/solaredge-web/p/chartParamsList?fieldId=${this.siteId}`,
        {
          headers: {
            "X-CSRF-TOKEN": this.x_csrf_token,
          },
        }
      );
    } catch (error: any) {
      throw new Error(`bootstrapSession fehlgeschlagen: ${error.message}`);
    }
  }

  async getMeasurements(
    requestedMeasurementsJSON: MeasurementRequestData
    // startDate: string,
    // endDate: string
  ) {
    try {
      const url = `https://monitoring.solaredge.com/services/charts/site/${this.siteId}/devices-measurements?start-date=2026-01-02&end-date=2026-01-02`;
      const response = await this.api.post(url, requestedMeasurementsJSON, {
        headers: {
          "Content-Type": "application/json",
          // "X-CSRF-TOKEN": this.x_csrf_token,
          "User-Agent": "PostmanRuntime/7.51.0",
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`getMeasurements fehlgeschlagen: ${error.message}`);
    }
  }

  async getTree(): Promise<SolarEdgeResponse> {
    const url = `https://monitoring.solaredge.com/services/charts/site/${this.siteId}/tree`;
    const response = await this.api.get(url, {
      maxRedirects: 0,
      validateStatus: () => true, // 401 wird NICHT als Exception geworfen
      // responseType: "text", // Body als Text (auch wenn HTML/JSON)
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: "https://monitoring.solaredge.com/",
        "X-CSRF-TOKEN": this.api.defaults.headers.common["X-CSRF-TOKEN"],
        "X-XSRF-TOKEN": this.api.defaults.headers.common["X-CSRF-TOKEN"],
      },
    });
    console.log("response.data", response.data);

    // Speichere response.data in eine JSON-Datei
    fs.writeFileSync("response.json", JSON.stringify(response.data, null, 2));
    console.log("Response data saved to response.json");

    return response.data as SolarEdgeResponse;
  }

  extractSiteNodesByItemType(
    itemType: ItemType,
    siteNode: SiteNode
  ): SiteNode[] {
    const result: SiteNode[] = [];
    if (siteNode.itemId.itemType == itemType) {
      result.push(siteNode);
    }
    siteNode.children?.forEach((child) => {
      const childResults = this.extractSiteNodesByItemType(itemType, child);
      result.push(...childResults);
    });
    return result;
  }

  async getDiagramData(): Promise<void> {
    const url = `https://monitoring.solaredge.com/services/charts/site/${this.siteId}/devices-measurements?start-date=2026-01-02&end-date=2026-01-02`;
    const data = {};
    const headers = {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": this.api.defaults.headers.common["X-CSRF-TOKEN"],
    };
    const response = await this.api.post(url, data);
    console.log(response);
  }
}
