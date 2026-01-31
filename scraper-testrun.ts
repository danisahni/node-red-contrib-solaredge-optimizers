#!/usr/bin/env node

import { config } from "dotenv";
import { SolarEdgeOptimizerScraperService } from "./src/services/solaredge-optimizer-scraper.service";
import { SolarEdgeDiagramScraperService } from "./src/services/solaredge-diagram-scraper-service/solaredege-diagram-scraper-service";
import { SolarEdgeApiService } from "./src/services/solaredge-api.service";
import { InfluxDbUtils } from "./src/services/influxdb-utils.service";

import fs from "fs";
import {
  ItemType,
  SolarEdgeTree,
  SiteNode,
  MeasurementRequestData,
  ITEM_TYPES,
  SITE_PARAMETERS,
  AnyParameter,
  INVERTER_PARAMETERS,
  STRING_PARAMETERS,
  OPTIMIZER_PARAMETERS,
  METER_PARAMETERS,
  BATTERY_PARAMETERS,
} from "./src/models";
import {
  MeasurementRecord,
  Measurements,
} from "./src/services/solaredge-diagram-scraper-service/models/measurements";

// Lade Umgebungsvariablen aus .env-Datei
config();

// Konfiguration aus Umgebungsvariablen
const CONFIG = {
  siteId: process.env.SOLAREDGE_SITE_ID!,
  username: process.env.SOLAREDGE_USERNAME!,
  password: process.env.SOLAREDGE_PASSWORD!,
};

async function main() {
  console.log("🌞 SolarEdge Optimizer - Zeitlicher Verlauf der letzten 24h\n");
  console.log("⏳ Verbinde mit SolarEdge API...\n");

  try {
    // API initialisieren
    const api = new SolarEdgeOptimizerScraperService(
      CONFIG.siteId,
      CONFIG.username,
      CONFIG.password,
    );

    console.log("📡 Versuche Login...");
    await api.login();
    const site = await api.requestSolarEdgeSite();
    console.log(`✅ Erfolgreich eingeloggt. System: ${site.siteId}`);
    console.log(`   Anzahl der Optimizer: ${site.optimizers.length}\n`);
    const opti = site.optimizers[0];
    console.log(
      `📊 Lade zeitlichen Verlauf des Optimizers ${opti.displayName}`,
    );
    // const endDate = null;
    // const startDate = null;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 48 * 60 * 60 * 1000);
    const data = await api.requestItemHistory(
      opti.optimizerId,
      startDate,
      endDate,
      "Current",
    );
    console.log(data);
  } catch (error) {
    console.error("❌ Fehler aufgetreten:");
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      console.error("   Stack:", error.stack);
    } else {
      console.error("   Unbekannter Fehler:", error);
    }
    process.exit(1);
  }
}
async function mainApiScraper() {
  const scraper = new SolarEdgeApiService(
    CONFIG.siteId,
    CONFIG.username,
    CONFIG.password,
  );
  await scraper.login();
  const timeUnit = "4";
  const timeZoneSettings = "UTC";
  const additionalInfo = true;

  let data = await scraper.getData(timeUnit, timeZoneSettings);
  console.log(data);
  if (additionalInfo) {
    data = await scraper.addAdditionalInfo(data);
  }
  console.log(data);
  fs.writeFileSync("./api-response.json", JSON.stringify(data, null, 2));
  const influxData = InfluxDbUtils.convertToInflux(data, "test_measurement");
  fs.writeFileSync("./influx-data.json", JSON.stringify(influxData, null, 2));
}
async function mainDiagramScraper() {
  // const scraper2 = new SolarEdgeOptimizerScraperService(
  //   CONFIG.siteId,
  //   CONFIG.username,
  //   CONFIG.password,
  // );
  // await scraper2.login();
  // const site2 = await scraper2.requestSolarEdgeSite();
  // console.log(site2);
  // fs.writeFileSync("./site-response.json", JSON.stringify(site2, null, 2));

  const scraper = new SolarEdgeDiagramScraperService(
    CONFIG.siteId,
    CONFIG.username,
    CONFIG.password,
  );
  await scraper.login();
  const tree = await scraper.getTree();
  console.log(tree);
  // const fileContent = fs.readFileSync("./tree.json", "utf-8");
  // const tree = JSON.parse(fileContent) as SolarEdgeTree;
  const selectedItemTypes: ItemType[] = [
    "SITE",
    "INVERTER",
    "STRING",
    "OPTIMIZER",
    "BATTERY",
    "METER",
  ];

  const measurementTypes: { key: ItemType; parameters: AnyParameter[] }[] = [
    {
      key: "SITE",
      parameters: JSON.parse(JSON.stringify(SITE_PARAMETERS)),
    },
    {
      key: "INVERTER",
      parameters: JSON.parse(JSON.stringify(INVERTER_PARAMETERS)),
    },
    {
      key: "STRING",
      parameters: JSON.parse(JSON.stringify(STRING_PARAMETERS)),
    },
    {
      key: "OPTIMIZER",
      parameters: JSON.parse(JSON.stringify(OPTIMIZER_PARAMETERS)),
    },
    {
      key: "METER",
      parameters: JSON.parse(JSON.stringify(METER_PARAMETERS)),
    },
    {
      key: "BATTERY",
      parameters: JSON.parse(JSON.stringify(BATTERY_PARAMETERS)),
    },
  ];

  // create data for get measurements
  const measurementRequestData: MeasurementRequestData = [];
  selectedItemTypes.forEach(async (t) => {
    const currentItems = scraper.extractItemsFromTreeByItemType(t, tree);
    const currentRequestData = scraper.createMeasurementRequestData(
      currentItems,
      measurementTypes,
    );
    measurementRequestData.push(...currentRequestData);
  });
  // const startDate = "2026-01-01";
  // const endDate = "2026-01-01";
  const measurements: Measurements = await scraper.getMeasurements(
    measurementRequestData,
    // startDate,
    // endDate,
  );
  console.log(measurements.length);
  fs.writeFileSync(
    "./measurements.json",
    JSON.stringify(measurements, null, 2),
  );
  const collectLifetimeEnergy = true;
  // append lifetime energy data to measurements
  if (collectLifetimeEnergy) {
    const logicalLayout = await scraper.getLogicalLayout();
    const lifetimeEnergy = await scraper.getLifetimeEnergy();
    const lifetimeEnergyMeasurementsTest =
      scraper.createLifetimeEnergyMeasurements(
        lifetimeEnergy,
        logicalLayout,
        selectedItemTypes,
      );
    fs.writeFileSync(
      "./lifetime-energy-measurements-test.json",
      JSON.stringify(lifetimeEnergyMeasurementsTest, null, 2),
    );
    fs.writeFileSync(
      "./logical-layout.json",
      JSON.stringify(logicalLayout, null, 2),
    );
    const lifetimeEnergyMeasurements = scraper.createLifetimeEnergyMeasurements(
      lifetimeEnergy,
      logicalLayout,
      selectedItemTypes,
      measurements,
    );
    fs.writeFileSync(
      "./lifetime-energy-measurements.json",
      JSON.stringify(lifetimeEnergyMeasurements, null, 2),
    );
    measurements.push(...lifetimeEnergyMeasurements);
  }
  console.log(measurements.length);
  const influxFormattedMeasurements =
    InfluxDbUtils.formatMeasurementsForInfluxDb(
      measurements,
      "test_measurement",
    );
  console.log(influxFormattedMeasurements.length);
  fs.writeFileSync(
    "./influxdb-measurements.json",
    JSON.stringify(influxFormattedMeasurements, null, 2),
  );
}
// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Programm beendet.");
  process.exit(0);
});

// Programm starten
mainDiagramScraper();
// mainApiScraper();
