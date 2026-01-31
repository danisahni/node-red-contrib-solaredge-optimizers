export const ITEM_TYPES = [
  "SITE",
  "INVERTER",
  "STRING",
  "OPTIMIZER",
  "METER",
  "BATTERY",
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export const SITE_PARAMETERS = [
  "PRODUCTION_POWER",
  "PRODUCTION_ENERGY",
  "KWH_KWP_RATIO",
  "IMPORT_ENERGY",
  "IMPORT_POWER",
  "EXPORT_ENERGY",
  "EXPORT_POWER",
] as const;

export type SiteParameter = (typeof SITE_PARAMETERS)[number];

export const INVERTER_PARAMETERS = [
  "AC_PRODUCTION_ENERGY",
  "AC_PRODUCTION_POWER",
  "AC_CONSUMPTION_ENERGY",
  "AC_CONSUMPTION_POWER",
  "KWH_KWP_RATIO",
  "DC_VOLTAGE",
  "AC_VOLTAGE_L1",
  "AC_VOLTAGE_L2",
  "AC_VOLTAGE_L3",
  "AC_CURRENT_L1",
  "AC_CURRENT_L2",
  "AC_CURRENT_L3",
  "AC_FREQUENCY_L1",
  "AC_FREQUENCY_L2",
  "AC_FREQUENCY_L3",
] as const;

export type InverterParameter = (typeof INVERTER_PARAMETERS)[number];

export const STRING_PARAMETERS = [
  "PRODUCTION_ENERGY",
  "PRODUCTION_POWER",
] as const;

export type StringParameter = (typeof STRING_PARAMETERS)[number];

export const OPTIMIZER_PARAMETERS = [
  "PRODUCTION_ENERGY",
  "PRODUCTION_POWER",
  "OPTIMIZER_OUTPUT_VOLTAGE",
  "MODULE_OUTPUT_VOLTAGE",
  "MODULE_CURRENT",
] as const;

export type OptimizerParameter = (typeof OPTIMIZER_PARAMETERS)[number];

export const METER_PARAMETERS = [
  "PRODUCTION_ENERGY",
  "PRODUCTION_POWER",
  "IMPORT_ENERGY",
  "IMPORT_POWER",
  "EXPORT_ENERGY",
  "EXPORT_POWER",
] as const;

export type MeterParameter = (typeof METER_PARAMETERS)[number];

export const BATTERY_PARAMETERS = [
  "STATE_OF_ENERGY",
  "DISCHARGE_POWER",
  "CHARGE_POWER",
  "DISCHARGE_ENERGY",
  "CHARGE_ENERGY",
] as const;

export type BatteryParameter = (typeof BATTERY_PARAMETERS)[number];

export type AnyParameter =
  | SiteParameter
  | InverterParameter
  | StringParameter
  | OptimizerParameter
  | MeterParameter
  | BatteryParameter;
