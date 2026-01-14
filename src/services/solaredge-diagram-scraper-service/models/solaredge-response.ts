import { ItemType } from "./parameters";

export interface ItemId {
  itemType: ItemType;
  id: string;
  identifier: string;
  originalSerial?: string;
  connectedToInverter?: string;
}

export interface SiteNode {
  itemId: ItemId;
  name?: string;
  uuid?: string;
  order?: number;
  parameters?: string[];
  children?: SiteNode[] | null;
  isContainChildren?: boolean;
  status?: string;
  // additional optional fields sometimes present on nodes
  reporterId?: number | null;
  model?: string;
  manufacturer?: string;
  nameplateCapacity?: number;
}

export interface SiteStructure {
  itemId: ItemId;
  name?: string;
  uuid?: string;
  parameters?: string[];
  children?: SiteNode[] | null;
}

export interface Meter {
  itemId: ItemId;
  name: string;
  reporterId?: number | null;
  uuid?: string;
  status?: string;
  model?: string;
  manufacturer?: string;
  parameters?: string[];
}

export interface Battery {
  itemId: ItemId;
  name?: string;
  reporterId?: number | null;
  uuid?: string;
  status?: string;
  model?: string;
  manufacturer?: string;
  nameplateCapacity?: number;
  parameters?: string[];
  children?: null;
}

export interface Storage {
  itemId: ItemId;
  parameters?: string[];
  children?: Battery[] | null;
}

export interface MeteorologicalData {
  itemId: ItemId;
  parameters?: string[];
}

export interface Environmental {
  meteorologicalData?: MeteorologicalData;
}

export interface SolarEdgeResponse {
  siteStructure: SiteStructure;
  meters?: Meter[];
  storage?: Storage;
  evChargers?: any[];
  smartHome?: any[];
  gateways?: any[];
  environmental?: Environmental;
  installationDate?: string;
}
