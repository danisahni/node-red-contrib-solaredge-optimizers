# SolarEdge optimizers node for Node-RED

This is a node for Node-RED to scrape optimizer data from your SolarEdge cloud. You'll need your login data (username, password) and your site ID.

## Installation

In your Node-RED directory:

```
npm install node-red-contrib-solaredge-optimizers
```

## Usage

The following data has to be provided in the node to access the optimizer data:

- **Username**: Your username at https://monitoring.solaredge.com.
- **Password**: The corresponding password
- **Site ID**: The ID of your site.
- **Time Interval**:
  - Daily: Data of the current day
  - Weekly: Data of the current/last week

Optional inputs are:

- **Time Zone Settings** \*: Choose the time zone of the output data timestamps:
  - UTC: Returns timestamps in UTC time
  - Local: Returns timestamps in local time zone
- **Collect Additional Info**: Scrapes the monitoring page for additional info such as _description_, _type_, _serial number_ and _manufacturer_.
- **Format For InfluxDB**: Returns the data in a format so that it can be directly sent to an InfluxDB batch node from [node-red-contrib-influxdb](https://flows.nodered.org/node/node-red-contrib-influxdb) (tested for InfluxDB 2.0). An example flow is provided in [examples/influxDbExample.json](./examples/influxDbExample.json).
- **InfluxDB Measurement**: In case _Format for InfluxDB_ is checked, the name of the measurement.

The node will return the power in Watt for each inverter, string and optimizer in 15 minute intervals for the selected time interval.

## Sources / Credits

The scraping code is based on this [gist](https://gist.github.com/cooldil/0b2c5ee22befbbfcdefd06c9cf2b7a98) and translated from Python to JavaScript.
The scraping for the additional information was inspired by the youtube video of [meintechblog.de](https://meintechblog.de/2023/09/08/solaredge-pv-leistung-auf-panelebene-selbst-mitloggen-und-per-grafana-visualisieren/)

## License

MIT
