const axios = require("axios");
const wrapper = require("axios-cookiejar-support").wrapper;
const CookieJar = require("tough-cookie").CookieJar;

const LOGIN_URL = "https://monitoring.solaredge.com/solaredge-apigw/api/login";
const DATA_URL =
  "https://monitoring.solaredge.com/solaredge-web/p/playbackData";
const DETAILS_URL =
  "https://monitoring.solaredge.com/solaredge-web/p/systemData";

module.exports = function (RED) {
  function SolaredgeOptimizersNode(config) {
    RED.nodes.createNode(this, config);
    this.siteId = config.siteId;
    this.timeUnit = config.timeUnit;
    this.timeZoneSettings = config.timeZoneSettings;
    this.collectAdditionalInfo = config.collectAdditionalInfo;
    this.formatForInfluxDb = config.formatForInfluxDb;
    this.influxDbMeasurement = config.influxDbMeasurement;
    var node = this;
    node.on("input", async function (msg, send, done) {
      try {
        const client = createClientWithCookieJar();
        const token = await login(
          client,
          this.credentials.username,
          this.credentials.password
        );
        let data = await getData(
          client,
          token,
          this.siteId,
          this.timeUnit,
          this.timeZoneSettings
        );
        if (this.collectAdditionalInfo) {
          let reporterIds = data.map((x) => x.reporterId);
          let tags = await getTags(client, token, this.siteId, reporterIds);
          data = data.map((x) => {
            let currentTags = tags.find((y) => y.reporterId == x.reporterId);
            if (currentTags) {
              Object.assign(x, currentTags);
            }
            return x;
          });
        }
        if (this.formatForInfluxDb) {
          data = convertToInflux(data, this.influxDbMeasurement);
        }
        msg.payload = data;
      } catch (error) {
        node.warn("error while fetching optimizer data");
        msg.payload = error;
      }
      send(msg);
      done();
    });
    return;
  }

  function createClientWithCookieJar() {
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));
    return client;
  }

  async function login(client, username, password) {
    let x_csrf_token = undefined;
    try {
      const params = new URLSearchParams();
      params.append("j_username", username);
      params.append("j_password", password);
      let response = await client.post(LOGIN_URL, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      x_csrf_token = response.headers["x-csrf-token"];
    } catch (error) {
      console.log(error);
    }
    return x_csrf_token;
  }

  async function getData(
    client,
    x_csrf_token,
    siteId,
    timeUnit,
    timeZoneSettings
  ) {
    try {
      const params = new URLSearchParams();
      params.append("fieldId", siteId);
      params.append("timeUnit", timeUnit);

      let response = await client.post(DATA_URL, params, {
        headers: {
          "X-CSRF-TOKEN": x_csrf_token,
        },
      });

      let data = cleanUpData(response.data, timeZoneSettings);
      return data;
    } catch (error) {
      console.log(error);
    }
  }

  async function getTags(client, x_csrf_token, siteId, reporterIds) {
    let tags = [];

    await Promise.all(
      reporterIds.map(async (id) => {
        const params = new URLSearchParams();
        params.append("fieldId", siteId);
        params.append("reporterId", id);
        params.append("type", "any");
        params.append("activeTab", "0");
        params.append("isPublic", false);
        try {
          response = await client.post(DETAILS_URL, params, {
            headers: {
              "X-CSRF-TOKEN": x_csrf_token,
            },
          });
          let text = response.data.split("=")[1].split(";")[0];
          let infoData = JSON.parse(text);
          infoData.reporterId = id;
          let tags_to_extract = [
            "reporterId",
            "serialNumber",
            "type",
            "description",
            "manufacturer",
          ];
          let currentTags = tags_to_extract.reduce((prev, curr) => {
            prev[curr] = infoData[curr];
            return prev;
          }, {});
          tags.push(currentTags);
        } catch (error) {
          console.log(error);
        }
      })
    );
    return tags;
  }

  function cleanUpData(text, timeZoneSettings) {
    text = text.replaceAll("'", '"');
    text = text
      .replaceAll("Array", "")
      .replaceAll("key", '"key"')
      .replaceAll("value", '"value"');
    text = text
      .replaceAll("timeUnit", '"timeUnit"')
      .replaceAll("fieldData", '"fieldData"')
      .replaceAll("reportersData", '"reportersData"');
    jsonData = JSON.parse(text);

    data = [];
    const regex = /GMT([+-]\d{4})/;
    const localGMT = new Date().toString().match(regex)[0];

    for (const dateString of Object.keys(jsonData["reportersData"])) {
      let localDateString =
        timeZoneSettings == "Local"
          ? dateString.replace("GMT", localGMT)
          : dateString;
      let date = new Date(localDateString);

      for (const sid of Object.keys(jsonData["reportersData"][dateString])) {
        for (const entry of Object.values(
          jsonData["reportersData"][dateString][sid]
        )) {
          let index = data.findIndex((x) => x.reporterId == entry["key"]);
          if (index == -1) {
            data.push({ reporterId: entry["key"], data: [] });
            index = data.length - 1;
          }
          // if (!(entry['key'] in data)) { data[entry['key']] = {} }
          let value = Number.parseFloat(entry["value"].replaceAll(",", ""));
          data[index].data.push({ timestamp: date.toISOString(), value });
          // data[entry['key']][date.toISOString()] = value;
        }
      }
    }
    return data;
  }

  function convertToInflux(data, measurement) {
    influxData = [];
    data.forEach((item) => {
      let tags = (({ data, ...o }) => o)(item);
      item.data.forEach((entry) => {
        let influxEntry = {
          measurement,
          fields: {
            power: entry.value,
          },
          tags: tags,
          timestamp: Date.parse(entry.timestamp), // unix timestamp
        };
        influxData.push(influxEntry);
      });
    });
    return influxData;
  }

  RED.nodes.registerType("solaredge-optimizers", SolaredgeOptimizersNode, {
    credentials: {
      username: { type: "text" },
      password: { type: "password" },
    },
  });
};
