import { ItemType } from "./parameters";

export interface ItemId {
  itemType: ItemType;
  id?: string; // optional, not always present
  identifier?: string; // optional, not present for METER
  originalSerial?: string;
  connectedToInverter?: string;
}

/**
 * Base interface for all items in the SolarEdge tree
 * (Site, Inverter, String, Optimizer, Meter, Battery)
 */
export interface TreeItem {
  itemId: ItemId;
  name?: string;
  uuid?: string;
  order?: number;
  parameters?: string[];
  status?: string;
  reporterId?: number | null;
  model?: string;
  manufacturer?: string;
  nameplateCapacity?: number;
}

export interface SiteNode extends TreeItem {
  children?: SiteNode[] | null;
  isContainChildren?: boolean;
}

export interface SiteStructure {
  itemId: ItemId;
  name?: string;
  uuid?: string;
  parameters?: string[];
  children?: SiteNode[] | null;
}

export interface Meter extends TreeItem {
  name: string; // override to make it required for Meter
}

export interface Battery extends TreeItem {
  children?: null;
}

export interface Storage {
  itemId: ItemId;
  parameters?: string[];
  children?: Battery[] | null;
}

export interface MeteorologicalData extends TreeItem {}

export interface Environmental {
  meteorologicalData?: MeteorologicalData;
}

export interface SolarEdgeTree {
  siteStructure: SiteStructure; // contains site, inverters, strings and optimizers
  meters?: Meter[];
  storage?: Storage;
  evChargers?: any[];
  smartHome?: any[];
  gateways?: any[];
  environmental?: Environmental;
  installationDate?: string;
}
