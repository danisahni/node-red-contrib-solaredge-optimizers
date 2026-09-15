#!/usr/bin/env node

import { config } from "dotenv";
import { SolarEdgeDiagramScraperService } from "./src/services/solaredge-diagram-scraper-service/solaredege-diagram-scraper-service";
import { InfluxDbUtils } from "./src/services/influxdb-utils.service";

import fs from "fs";
import {
  ItemType,
  MeasurementRequestData,
  SITE_PARAMETERS,
  AnyParameter,
  INVERTER_PARAMETERS,
  STRING_PARAMETERS,
  OPTIMIZER_PARAMETERS,
  METER_PARAMETERS,
  BATTERY_PARAMETERS,
} from "./src/models";
import { Measurements } from "./src/services/solaredge-diagram-scraper-service/models/measurements";

// Lade Umgebungsvariablen aus .env-Datei
config();

// Konfiguration aus Umgebungsvariablen
const CONFIG = {
  siteId: process.env.SOLAREDGE_SITE_ID!,
  username: process.env.SOLAREDGE_USERNAME!,
  password: process.env.SOLAREDGE_PASSWORD!,
};

async function mainDiagramScraper() {
  const scraper = new SolarEdgeDiagramScraperService(
    CONFIG.siteId,
    CONFIG.username,
    CONFIG.password,
  );
  await scraper.login();
  const tree = await scraper.getTree();
  console.log(tree);
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
  const measurements: Measurements = await scraper.getMeasurements(
    measurementRequestData,
  );
  console.log(measurements.length);
  fs.writeFileSync(
    "./measurements.json",
    JSON.stringify(measurements, null, 2),
  );
  const collectLifetimeEnergy = true;
  // append lifetime energy data to measurements
  if (collectLifetimeEnergy) {
    const lifetimeEnergyMeasurements = await scraper.getLifetimeEnergyMeasurements(
      tree,
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
