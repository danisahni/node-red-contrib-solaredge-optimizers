# Solaredge optimizers node for Node-RED

This is a node for Node-RED to scrape optimizer data from your SolarEdge cloud. You'll need your login data (username, password) and your site ID.

## Installation

In your Node-RED directory:

```
npm install node-red-contrib-solaredge-optimizers
```

## Usage

The following data has to be provided in the node to access the optimizer data:
  * **Username**: Your username at https://monitoring.solaredge.com.
  * **Password**: The corresponding password
  * **Site ID**: The ID of your site.

The node will return the power in Watt for each inverter, string and optimizer in 15 minute intervals for the current day. Each component is identified via a reporterId.

## ReporterId mapping
To find the corresponding inverter, string or optimizer behind the cryptic reporterId, login to https://monitoring.solaredge.com and go to the site's layout page.

Open your **Web Developer Tools** (e.g. press F12 in Firefox) and go to the **Network** tab.
Now select - for instance - a panel and press the info button. On the network monitor there should be a GET request stating the reporterID.

![Network Monitor](images/reporterId.png?raw=true "Title")

## Sources

The scraping code is based on this [gist](https://gist.github.com/cooldil/0b2c5ee22befbbfcdefd06c9cf2b7a98). 
The mapping idea is taken from the youtube video of [meintechblog.de](https://meintechblog.de/2023/09/08/solaredge-pv-leistung-auf-panelebene-selbst-mitloggen-und-per-grafana-visualisieren/)


## License

MIT