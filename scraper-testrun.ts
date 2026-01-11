#!/usr/bin/env node

import { config } from "dotenv";
import { SolarEdgeOptimizerScraperService } from "./src/services/solaredge-optimizer-scraper.service";
import { SolarEdgeDiagramScraper } from "./src/services/solaredege-diagram-scraper.service";
import fs from "fs";
import {
  ItemType,
  SolarEdgeResponse,
  SiteNode,
  MeasurementRequestData,
  ITEM_TYPES,
} from "./src/models";

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
      CONFIG.password
    );

    console.log("📡 Versuche Login...");
    await api.login();
    const site = await api.requestSolarEdgeSite();
    console.log(`✅ Erfolgreich eingeloggt. System: ${site.siteId}`);
    console.log(`   Anzahl der Optimizer: ${site.optimizers.length}\n`);
    const opti = site.optimizers[0];
    console.log(
      `📊 Lade zeitlichen Verlauf des Optimizers ${opti.displayName}`
    );
    // const endDate = null;
    // const startDate = null;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 48 * 60 * 60 * 1000);
    const data = await api.requestItemHistory(
      opti.optimizerId,
      startDate,
      endDate,
      "Current"
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

async function mainDiagramScraper() {
  const scraper = new SolarEdgeDiagramScraper(
    CONFIG.siteId,
    CONFIG.username,
    CONFIG.password
  );
  // await scraper.login();
  // await scraper.bootstrapSession();
  // const site = await scraper.getSite();
  // console.log(site);
  const fileContent = fs.readFileSync("./response.json", "utf-8");
  const tree = JSON.parse(fileContent) as SolarEdgeResponse;
  const typeSortedSiteNodes: SiteNode[][] = [];

  ITEM_TYPES.forEach((t) => {
    typeSortedSiteNodes.push(
      scraper.extractSiteNodesByItemType(t, tree.siteStructure)
    );
  });
  console.log(typeSortedSiteNodes);

  // create data for get measurements
  await scraper.login();
  await scraper.bootstrapSession();
  const requestContent = fs.readFileSync("./request.json", "utf-8");
  const requestedMeasurementsJSON = JSON.parse(
    requestContent
  ) as MeasurementRequestData;
  const measurements = await scraper.getMeasurements(requestedMeasurementsJSON);
  console.log(measurements);
}
// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Programm beendet.");
  process.exit(0);
});

// Programm starten
mainDiagramScraper();
