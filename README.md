# SolarEdge optimizers node for Node-RED

This is a node for Node-RED to scrape optimizer data from your SolarEdge cloud. You'll need your login data (username, password) and your site ID.

## Installation

In your Node-RED directory:

```
npm install node-red-contrib-solaredge-optimizers
```

## Usage

There are two nodes available with two different approaches to scrape data from the solaredge monitoring platform. Their usage will be explained below

### solaredge-optimizers node (deprecated)

**This node is deprecated and no longer works.** SolarEdge retired the API endpoints it relied on (the old session-based login and the `layout`/`playbackData` endpoints); the node now only reports a deprecation error instead of data.

Please migrate to the **solaredge-diagram-data-scraper** node below - select **OPTIMIZER** under _Types_ to get equivalent per-optimizer data. The diagram-data-scraper node covers everything this node did (and more), using SolarEdge's current authentication.

### solaredge-diagram-data-scraper Node

This node collects data from the diagram page of the solaredge monitoring platform for the current day.

The node needs the following inputs as required parameters:

- **Username**: Your username at https://monitoring.solaredge.com.
- **Password**: The corresponding password
- **Site ID**: The ID of your site.

Furthermore, optional parameters can be specified:

- **Time Zone Settings** \*: Choose the time zone of the output data timestamps:
  - UTC: Returns timestamps in UTC time
  - Local: Returns timestamps in local time zone
- **Collect Lifetime Energy**: Scrapes the monitoring page for the lifetime energy at the time the node is triggered. Note: Lifetime data is not included in the diagram page and needs to be collected separately. Hence, lifetime energy returns only the current value and no time series data. Only for the selected component types lifetime energy will be returned.
- **Format For InfluxDB**: Returns the data in a format so that it can be directly sent to an InfluxDB batch node from [node-red-contrib-influxdb](https://flows.nodered.org/node/node-red-contrib-influxdb) (tested for InfluxDB 2.0). An example flow is provided in [examples/diagramDataScraperInfluxDbExample.json](./examples/diagramDataScraperInfluxDbExample.json). Note: The _Time Precision_ of the InfluxDb batch node has to be set to _"Milliseconds (ms)"_.
- **InfluxDB Measurement**: In case _Format for InfluxDB_ is checked, the name of the measurement.
- **Types**: Select the type of components for which data shall be collected. At the time, this includes **SITE**, **INVERTER**, **STRING**, **OPTIMIZER**, **METER**, **BATTERY**
- **Parameters**: For each selected component type you can choose the parameters that shall be collected.

## Sources / Credits

The scraping code from the layout page is based on this [gist](https://gist.github.com/cooldil/0b2c5ee22befbbfcdefd06c9cf2b7a98) and translated from Python to JavaScript.
The scraping for the additional information for the optimizer-node was inspired by the youtube video of [meintechblog.de](https://meintechblog.de/2023/09/08/solaredge-pv-leistung-auf-panelebene-selbst-mitloggen-und-per-grafana-visualisieren/)

Credits to [@waltterli](https://github.com/waltterli) for finding a way to collect the data from the diagram page. This node would not exist without you :).

## License

MIT
