# SolarEdge optimizers node for Node-RED

This is a node for Node-RED to scrape optimizer data from your SolarEdge cloud. You'll need your login data (username, password) and your site ID.

## Installation

In your Node-RED directory:

```
npm install node-red-contrib-solaredge-optimizers
```

## Usage

There are three nodes available with different approaches to scrape data from the solaredge monitoring platform. Their usage will be explained below

### solaredge-optimizers node (deprecated)

**This node is deprecated and no longer works.** SolarEdge retired the API endpoints it relied on (the old session-based login and the `layout`/`playbackData` endpoints); the node now only reports a deprecation error instead of data.

Please migrate to the **solaredge-diagram-data-scraper** node below - select **OPTIMIZER** under _Types_ to get equivalent per-optimizer data. The diagram-data-scraper node covers everything this node did (and more), using SolarEdge's current authentication.

### solaredge-diagram-data-scraper Node

This node collects data from the diagram page of the solaredge monitoring platform for the current day (or a past date range, see below).

The node needs the following inputs as required parameters:

- **Username**: Your username at https://monitoring.solaredge.com.
- **Password**: The corresponding password
- **Site ID**: The ID of your site.

A basic example flow (without InfluxDB formatting) is provided in [examples/basicExample.json](./examples/basicExample.json).

Furthermore, optional parameters can be specified:

- **Time Zone Settings** \*: Choose the time zone of the output data timestamps:
  - UTC: Returns timestamps in UTC time
  - Local: Returns timestamps in local time zone
- **Collect Lifetime Energy**: Scrapes the monitoring page for the lifetime energy at the time the node is triggered. Note: Lifetime data is not included in the diagram page and needs to be collected separately. Hence, lifetime energy returns only the current value and no time series data. Only for the selected component types lifetime energy will be returned.
- **Format For InfluxDB**: Returns the data in a format so that it can be directly sent to an InfluxDB batch node from [node-red-contrib-influxdb](https://flows.nodered.org/node/node-red-contrib-influxdb) (tested for InfluxDB 2.0). An example flow is provided in [examples/diagramDataScraperInfluxDbExample.json](./examples/diagramDataScraperInfluxDbExample.json). Note: The _Time Precision_ of the InfluxDb batch node has to be set to _"Milliseconds (ms)"_.
- **InfluxDB Measurement**: In case _Format for InfluxDB_ is checked, the name of the measurement.
- **Types**: Select the type of components for which data shall be collected. At the time, this includes **SITE**, **INVERTER**, **STRING**, **OPTIMIZER**, **METER**, **BATTERY**
- **Parameters**: For each selected component type you can choose the parameters that shall be collected.

By default the node fetches the current day. To fetch past data, e.g. to fill gaps after a database outage, set these optional properties on the incoming message:

- `msg.startDate`: first calendar day (in the site's time zone), as `YYYY-MM-DD`. Without `msg.endDate`, data is fetched from this day until today.
- `msg.endDate`: last calendar day (inclusive), as `YYYY-MM-DD`. Without `msg.startDate`, only this day is fetched.

An example flow is provided in [examples/diagramDataScraperBackfillExample.json](./examples/diagramDataScraperBackfillExample.json).

**Resolution** (as of October 2026): The diagram-page API has no interval setting - SolarEdge picks the resolution itself, and the longer the requested range, the coarser the data:

| Requested range | Inverter, string, battery, meter power | Optimizer, site |
|---|---|---|
| 1 day | 5 minutes | 15 minutes |
| 2 - 7 days | 15 minutes | 1 hour |
| 8 - 31 days | 1 hour (string: error above 14 days) | 1 day |
| longer | error | 1 month |

The node therefore requests one day at a time, so past days always have the same resolution as the regular data: 5 minutes for inverter, string, battery and meter power values, 15 minutes for optimizer, site and meter energy values.

**History** (as of October 2026): SolarEdge keeps optimizer data for roughly the last 4 months (string data somewhat longer) and the other types for the last 2 years. Older data is rejected with an error such as `DATASET_TOO_LARGE`.

Resolution and history are set by SolarEdge and may change. Overlapping data in InfluxDB is overwritten, not duplicated (see the notes below under _solaredge-custom-analysis-scraper_).

### solaredge-custom-analysis-scraper Node

This node collects data from the same API as SolarEdge's "Custom Analysis" page (`/services/cni/ui-api/.../generate-chart`). Unlike `solaredge-diagram-data-scraper`, it supports a **configurable measurement interval** - the diagram-page API always returns a fixed resolution per data type (5 or 15 minutes for a single day).

The trade-off: this API uses a different metric-naming scheme than the diagram page (e.g. `active_power` instead of `AC_PRODUCTION_POWER`), and a few parameters available on the diagram page have no equivalent here - site-level power values, inverter consumption, `KWH_KWP_RATIO`, and battery charge/discharge power.

The node needs the same required inputs as `solaredge-diagram-data-scraper` (Username, Password, Site ID), plus:

- **Measurement Interval**: Resolution of the returned time series - **5 minutes**, **15 minutes**, **1 hour** or **1 day**.
- **Legacy Parameter Names**: Old `solaredge-diagram-data-scraper` parameter names (e.g. `AC_PRODUCTION_POWER`) are always accepted as input on this node too, so switching over doesn't require reselecting parameters you already had configured. By default, however, the *output* field names (and therefore InfluxDB field names) use this node's new names. Enable this option to have the output use the old names instead, for continuity with data already collected under those field names. Only parameters with a verified old-name equivalent are affected.
- All other options (Time Zone Settings, Collect Lifetime Energy, Format For InfluxDB, InfluxDB Measurement, Types, Parameters) work the same way as on `solaredge-diagram-data-scraper`, just against this node's own parameter catalog.

By default the node fetches the current day (UTC). To fetch past data, e.g. to fill gaps after a database outage, set these optional properties on the incoming message:

- `msg.startDate`: first UTC calendar day, as `YYYY-MM-DD`. Without `msg.endDate`, data is fetched from this day until today.
- `msg.endDate`: last UTC calendar day (inclusive), as `YYYY-MM-DD`. Without `msg.startDate`, only this day is fetched.

An example flow is provided in [examples/customAnalysisScraperBackfillExample.json](./examples/customAnalysisScraperBackfillExample.json).

**Resolution** (as of October 2026): The selected Measurement Interval is kept for any range length. SolarEdge limits how many days one request may cover (e.g. 14 days for optimizer data at hourly or finer interval) and silently returns coarser data for some longer requests, so the node splits ranges into requests of at most 14 days. Exception: meter values always come in 15 minute steps, whatever interval is selected. Optimizer data is available in 5 minute steps here, while the diagram-page API only offers 15 minutes.

**History** (as of October 2026): Optimizer and string data is available for the last 90 days (at any interval), the other types for the last 2 years at 5 minute / 15 minute / 1 hour interval. Daily inverter values go back further (tested back to 2022). Older data is rejected with an error message that names the current limit.

Resolution and history are set by SolarEdge and may change.

Fetching a range that overlaps data already in InfluxDB does not create duplicates: InfluxDB identifies a point by measurement, tags and timestamp, so the existing point is simply overwritten with the same values. Keep in mind:

- **Use the same Measurement Interval** as for your regular data, or a separate InfluxDB measurement name per interval. 15 minute, hourly and daily timestamps coincide with some 5 minute timestamps, so backfilling with a different interval into the same measurement overwrites those points with aggregated values.
- Renaming a device in SolarEdge changes the `deviceName` tag and therefore starts a new series.
- Toggling **Legacy Parameter Names** changes the field names, so the same values would be stored under both names.

## Sources / Credits

The scraping code from the layout page is based on this [gist](https://gist.github.com/cooldil/0b2c5ee22befbbfcdefd06c9cf2b7a98) and translated from Python to JavaScript.
The scraping for the additional information for the optimizer-node was inspired by the youtube video of [meintechblog.de](https://meintechblog.de/2023/09/08/solaredge-pv-leistung-auf-panelebene-selbst-mitloggen-und-per-grafana-visualisieren/)

Credits to [@waltterli](https://github.com/waltterli) for finding a way to collect the data from the diagram page. This node would not exist without you :).

## License

MIT
