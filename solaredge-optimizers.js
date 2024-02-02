const axios = require('axios');
const wrapper = require('axios-cookiejar-support').wrapper;
const CookieJar = require('tough-cookie').CookieJar;

const LOGIN_URL = 'https://monitoring.solaredge.com/solaredge-apigw/api/login';
const DATA_URL = 'https://monitoring.solaredge.com/solaredge-web/p/playbackData';

module.exports = function (RED) {
    function SolaredgeOptimizersNode(config) {
        RED.nodes.createNode(this, config);
        this.siteId = config.siteId;
        this.timeUnit = config.timeUnit;
        var node = this;
        node.on('input', async function (msg, send, done) {
            try {
                let data = await getData(this.credentials.username, this.credentials.password, this.siteId, this.timeUnit);
                msg.payload = data;
            } catch (error) {
                node.warn('error while fetching optimizer data')
                msg.payload = error;
            }
            send(msg);
            done();
        });
        return;
    }

    async function getData(username, password, siteId, timeUnit) {
        const jar = new CookieJar();
        const client = wrapper(axios.create({ jar }));
        let x_csrf_token = undefined;
        try {
            const params = new URLSearchParams();
            params.append('j_username', username);
            params.append('j_password', password);
            let response = await client.post(LOGIN_URL, params, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            });
            x_csrf_token = response.headers['x-csrf-token'];
            console.log(response);
        } catch (error) {
            console.log(error)
        }
        try {
            const params = new URLSearchParams();
            params.append("fieldId", siteId);
            params.append("timeUnit", timeUnit);

            let response = await client.post(DATA_URL, params, {
                headers: {
                    'X-CSRF-TOKEN': x_csrf_token,
                }
            })
            let data = cleanUpData(response.data);
            return data;
        }
        catch (error) {
            console.log(error);
        }
    }

    function cleanUpData(text) {
        text = text.replaceAll('\'', '"');
        text = text.replaceAll('Array', '').replaceAll('key', '"key"').replaceAll(
            'value', '"value"');
        text = text.replaceAll('timeUnit', '"timeUnit"').replaceAll('fieldData', '"fieldData"').replaceAll('reportersData',
            '"reportersData"');
        jsonData = JSON.parse(text);
        data = {}
        for (const dateString of Object.keys(jsonData['reportersData'])) {
            let date = new Date(dateString);
            for (const sid of Object.keys(jsonData['reportersData'][dateString])) {
                for (const entry of Object.values(jsonData['reportersData'][dateString][sid])) {
                    if (!(entry['key'] in data)) { data[entry['key']] = {} }
                    let value = Number.parseFloat(entry['value'].replaceAll(',', ''));
                    data[entry['key']][date.toISOString()] = value;
                }
            }
        }
        return data;
    }

    RED.nodes.registerType("solaredge-optimizers", SolaredgeOptimizersNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    });
}
