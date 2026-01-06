/** SolarEdge Optimizers TypeScript Module - Clean Version matching Python original */

import axios from "axios";
import type { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

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

  async login() {
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

      const cookies = await this.api.defaults.jar?.getCookies(
        "https://monitoring.solaredge.com"
      );
      const cookieData = cookies?.map((c: any) => c.toJSON());
      return cookieData;
    } catch (error: any) {
      throw new Error(`login fehlgeschlagen: ${error.message}`);
    }
  }

  async login2(): Promise<void> {
    let x_csrf_token = undefined;
    try {
      const params = new URLSearchParams();
      params.append("j_username", this.username);
      params.append("j_password", this.password);
      const url = "https://monitoring.solaredge.com/solaredge-apigw/api/login";
      let response = await this.api.post(url, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      x_csrf_token = response.headers["x-csrf-token"];
      console.log(x_csrf_token);
      // Store CSRF token and set as default header for future requests
      if (x_csrf_token) {
        this.api.defaults.headers.common["X-CSRF-TOKEN"] = x_csrf_token;
      }

      // Debug: Check what cookies are stored in CookieJar after login
      const jar = (this.api.defaults as any).jar;
      if (jar) {
        const cookies = await jar.getCookies(
          "https://monitoring.solaredge.com"
        );
        console.log("🍪 Cookies stored after login:");
        cookies.forEach((cookie: any, index: number) => {
          console.log(`  ${index + 1}. ${cookie.key}=${cookie.value}`);
          console.log(
            `     Path: ${cookie.path}, Domain: ${cookie.domain}, Secure: ${cookie.secure}`
          );
        });
        console.log(`Total cookies: ${cookies.length}`);
      } else {
        console.log("❌ No CookieJar found");
      }
    } catch (error) {
      console.log(error);
    }
  }

  async bootstrapSession(): Promise<void> {
    try {
      const response = await this.api.get(
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
    requestedMeasurementsJSON: object[],
    startDate: string,
    endDate: string
  ) {
    /* Works only, if before getHisotryData() was called. Otherwise session cookie is missing. */
    let debug = undefined;
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

  async getSite(): Promise<Site> {
    const url = `https://monitoring.solaredge.com/services/charts/site/${this.siteId}/tree`;
    const response = await this.api.get(url, {
      maxRedirects: 0,
      validateStatus: () => true, // 401 wird NICHT als Exception geworfen
      responseType: "text", // Body als Text (auch wenn HTML/JSON)
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: "https://monitoring.solaredge.com/",
        "X-CSRF-TOKEN": this.api.defaults.headers.common["X-CSRF-TOKEN"],
        "X-XSRF-TOKEN": this.api.defaults.headers.common["X-CSRF-TOKEN"],
      },
    });
    console.log("status", response.status);
    console.log("headers", response.headers);
    console.log("body (first 500)", String(response.data).slice(0, 500));
    return new Site(this.siteId);
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

export class Site {
  id: string;

  constructor(id: string) {
    this.id = id;
  }
}

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

    this.strings = this.getStringInformation(children);
  }

  private getStringInformation(children: any[]): SolarEdgeString[] {
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

export class SolarEdgeString {
  stringId: string;
  serialNumber: string;
  name: string;
  displayName: string;
  relativeOrder: number;
  type: string;
  operationsKey: string;
  optimizers: SolarEdgeOptimizer[];

  constructor(jsonObj: any) {
    this.stringId = jsonObj.data.id;
    this.serialNumber = jsonObj.data.serialNumber;
    this.name = jsonObj.data.name;
    this.displayName = jsonObj.data.displayName;
    this.relativeOrder = jsonObj.data.relativeOrder;
    this.type = jsonObj.data.type;
    this.operationsKey = jsonObj.data.operationsKey;
    this.optimizers = this.getOptimizers(jsonObj);
  }

  private getOptimizers(jsonObj: any): SolarEdgeOptimizer[] {
    const optimizers: SolarEdgeOptimizer[] = [];

    for (const child of jsonObj.children || []) {
      optimizers.push(new SolarEdgeOptimizer(child));
    }

    return optimizers;
  }
}

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

export class SolarEdgeOptimizerData {
  serialnumber: string;
  panel_id: string;
  panel_description: string;
  lastmeasurement: Date;
  model: string;
  manufacturer: string;
  current: number;
  optimizer_voltage: number;
  power: number;
  voltage: number;
  lifetime_energy: number = 0;

  constructor(panelId: string, jsonObject: any) {
    this.serialnumber = jsonObject.serialNumber;
    this.panel_id = panelId;
    this.panel_description = jsonObject.description;

    // Parse the date like Python version
    const rawDate = jsonObject.lastMeasurementDate;
    const dateParts = rawDate.split(" ");
    const newTime = `${dateParts[0]} ${dateParts[1]} ${dateParts[2]} ${dateParts[3]} ${dateParts[5]}`;
    this.lastmeasurement = new Date(newTime);

    this.model = jsonObject.model;
    this.manufacturer = jsonObject.manufacturer;

    this.current = parseFloat(jsonObject.measurements["Current [A]"]);
    this.optimizer_voltage = parseFloat(
      jsonObject.measurements["Optimizer Voltage [V]"]
    );
    this.power = parseFloat(jsonObject.measurements["Power [W]"]);
    this.voltage = parseFloat(jsonObject.measurements["Voltage [V]"]);
  }
}
