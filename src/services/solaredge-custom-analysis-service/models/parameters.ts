import {
  ITEM_TYPES,
  ItemType,
} from "../../solaredge-diagram-scraper-service/models/parameters";

export { ITEM_TYPES };

// Metrics for SolarEdge's newer /services/cni/ui-api/.../generate-chart
// endpoint (the one behind their "Custom Analysis" page). This is a
// different catalog from the legacy diagram-page parameters, not a rename -
// see LEGACY_PARAMETER_ALIASES below for which old names have a verified
// equivalent here.

// SITE metrics come from the "exported_imported_energy" calculation
// category - the only category of the (much larger) site calculation
// catalog with a clean production/import/export energy equivalent. There is
// no site-level power metric in this API at all.
export const SITE_PARAMETERS = [
  "produced_energy",
  "total_production",
  "consumed_energy",
  "imported_energy",
  "exported_energy",
] as const;

export type SiteParameter = (typeof SITE_PARAMETERS)[number];

export const INVERTER_PARAMETERS = [
  "power",
  "energy_since_last_telemetry",
  "active_power",
  "negative_active_power",
  "apparent_power",
  "reactive_power",
  "power_factor",
  "positive_ac_energy_since_last_telemetry",
  "negative_ac_energy_since_last_telemetry",
  "lifetime_positive_ac_energy",
  "lifetime_negative_ac_energy",
  "dc_voltage",
  "ac_voltage",
  "ac_voltage_l1",
  "ac_voltage_l2",
  "ac_voltage_l3",
  "ac_voltage_12",
  "ac_voltage_23",
  "ac_voltage_31",
  "ac_current",
  "ac_current_l1",
  "ac_current_l2",
  "ac_current_l3",
  "ac_current_dc_component",
  "ac_current_dc_component_1",
  "ac_current_dc_component_2",
  "ac_current_dc_component_3",
  "ac_frequency",
  "ac_frequency_l1",
  "ac_frequency_l2",
  "ac_frequency_l3",
  "temperature",
  "operation_mode",
  "status",
  "relay_status",
  "derating_active",
  "ground_fault_resistance",
  "rcd_current",
] as const;

export type InverterParameter = (typeof INVERTER_PARAMETERS)[number];

// Unlike every other device type, STRING is only exposed via the
// "calculation" metric type (category "optimizer_calculations") and is
// addressed by the tree node's uuid rather than its itemId.id.
export const STRING_PARAMETERS = ["energy", "power"] as const;

export type StringParameter = (typeof STRING_PARAMETERS)[number];

export const OPTIMIZER_PARAMETERS = [
  "output_power",
  "output_voltage",
  "output_current",
  "panel_voltage",
  "panel_current",
  "temperature",
  "temperature_in",
  "temperature_out",
  "temperature_power_train",
  "energy_since_last_telem",
] as const;

export type OptimizerParameter = (typeof OPTIMIZER_PARAMETERS)[number];

export const METER_PARAMETERS = [
  "active_power_total",
  "active_power_1",
  "active_power_2",
  "active_power_3",
  "negative_active_power_total",
  "negative_active_power_1",
  "negative_active_power_2",
  "negative_active_power_3",
  "positive_active_power_total",
  "apparent_power_total",
  "reactive_power_total",
  "reactive_power_1",
  "reactive_power_2",
  "reactive_power_3",
  "positive_active_energy",
  "positive_active_energy_1",
  "positive_active_energy_2",
  "positive_active_energy_3",
  "negative_active_energy",
  "negative_active_energy_1",
  "negative_active_energy_2",
  "negative_active_energy_3",
  "positive_active_energy_since_last_telemetry",
  "negative_active_energy_since_last_telemetry",
  "apparent_energy",
  "apparent_energy_1",
  "apparent_energy_2",
  "apparent_energy_3",
  "reactive_energy",
  "reactive_energy_1",
  "reactive_energy_2",
  "reactive_energy_3",
  "voltage_1n",
  "voltage_2n",
  "voltage_3n",
  "voltage_12",
  "voltage_23",
  "voltage_31",
  "current_1",
  "current_2",
  "current_3",
  "power_factor_1",
  "power_factor_2",
  "power_factor_3",
  "frequency",
] as const;

export type MeterParameter = (typeof METER_PARAMETERS)[number];

// SolarEdge's newer API calls this device type STORAGE, not BATTERY - the
// ItemType/tree naming stays BATTERY throughout this project for
// consistency with the site tree response, and is mapped to STORAGE only
// where the generate-chart request itself is built.
export const BATTERY_PARAMETERS = [
  "power",
  "current",
  "voltage",
  "state_of_energy",
  "state",
  "remaining_energy",
  "charged_energy_delta",
  "discharged_energy_delta",
  "temperature",
] as const;

export type BatteryParameter = (typeof BATTERY_PARAMETERS)[number];

export type AnyParameter =
  | SiteParameter
  | InverterParameter
  | StringParameter
  | OptimizerParameter
  | MeterParameter
  | BatteryParameter;

// Maps the legacy diagram-page parameter names to their verified equivalent
// in this catalog - lets a flow migrating from solaredge-diagram-data-scraper
// keep its old InfluxDB field names via the "Legacy Parameter Names" option.
// Verified empirically by comparing old- and new-endpoint values for the
// same device/timestamp side by side; parameters with no confirmed
// equivalent (e.g. AC_CONSUMPTION_*, the site-level *_POWER fields,
// KWH_KWP_RATIO, battery CHARGE_POWER/DISCHARGE_POWER whose sign convention
// couldn't be confirmed) are intentionally left out rather than guessed.
export const LEGACY_PARAMETER_ALIASES: Partial<Record<ItemType, Record<string, string>>> = {
  SITE: {
    PRODUCTION_ENERGY: "produced_energy",
    IMPORT_ENERGY: "imported_energy",
    EXPORT_ENERGY: "exported_energy",
  },
  INVERTER: {
    AC_PRODUCTION_POWER: "active_power",
    AC_PRODUCTION_ENERGY: "positive_ac_energy_since_last_telemetry",
    DC_VOLTAGE: "dc_voltage",
    AC_VOLTAGE_L1: "ac_voltage_l1",
    AC_VOLTAGE_L2: "ac_voltage_l2",
    AC_VOLTAGE_L3: "ac_voltage_l3",
    AC_CURRENT_L1: "ac_current_l1",
    AC_CURRENT_L2: "ac_current_l2",
    AC_CURRENT_L3: "ac_current_l3",
    AC_FREQUENCY_L1: "ac_frequency_l1",
    AC_FREQUENCY_L2: "ac_frequency_l2",
    AC_FREQUENCY_L3: "ac_frequency_l3",
  },
  STRING: {
    PRODUCTION_ENERGY: "energy",
    PRODUCTION_POWER: "power",
  },
  OPTIMIZER: {
    PRODUCTION_POWER: "output_power",
    PRODUCTION_ENERGY: "energy_since_last_telem",
    OPTIMIZER_OUTPUT_VOLTAGE: "output_voltage",
    MODULE_OUTPUT_VOLTAGE: "panel_voltage",
    MODULE_CURRENT: "panel_current",
  },
  METER: {
    IMPORT_POWER: "negative_active_power_total",
    EXPORT_POWER: "positive_active_power_total",
    IMPORT_ENERGY: "negative_active_energy_since_last_telemetry",
    EXPORT_ENERGY: "positive_active_energy_since_last_telemetry",
    PRODUCTION_POWER: "active_power_total",
    PRODUCTION_ENERGY: "positive_active_energy_since_last_telemetry",
  },
  BATTERY: {
    STATE_OF_ENERGY: "state_of_energy",
    CHARGE_ENERGY: "charged_energy_delta",
    DISCHARGE_ENERGY: "discharged_energy_delta",
  },
};

export const MEASUREMENT_GRANULARITIES = [
  "FIVE_MINUTES",
  "QUARTER_HOUR",
  "HOUR",
  "DAY",
] as const;

export type MeasurementGranularity = (typeof MEASUREMENT_GRANULARITIES)[number];
