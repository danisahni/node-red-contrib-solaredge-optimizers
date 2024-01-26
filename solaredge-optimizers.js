const LOGIN_URL = 'https://monitoring.solaredge.com/solaredge-apigw/api/login';
const DATA_URL = 'https://monitoring.solaredge.com/solaredge-web/p/playbackData';

module.exports = function (RED) {
    function SolaredgeOptimizersNode(config) {
        RED.nodes.createNode(this, config);
        this.siteId = config.siteId;
        var node = this;
        node.on('input', async function (msg, send, done) {
            let headers;
            try {
                headers = await getCookiesAndHeaders(this.credentials.username, this.credentials.password);
            } catch (error) {
                node.warn('error while getting authentication cookies')
                msg.payload = error;
            }
            try {
                let data = await getData(headers, this.siteId);
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

    async function getCookiesAndHeaders(username, password) {
        let response;

        var urlencoded = new URLSearchParams();
        urlencoded.append("j_username", username);
        urlencoded.append("j_password", password);

        var requestOptions = {
            method: 'POST',
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: urlencoded,
            redirect: 'manual',
        };


        try {
            response = await fetch(LOGIN_URL, requestOptions);

        } catch (error) {
            response = error.response
        }
        if (response.status == 302) {
            let cookies = response.headers.getSetCookie();
            let requestOptions2 = {
                method: 'GET',
                headers: {
                    cookie: cookies,
                },
                redirect: 'manual',
            }
            let response2 = await fetch(response.headers.get('Location'), requestOptions2)
            let cookies2 = response2.headers.getSetCookie();
            let xcsrf = response2.headers.get('X-CSRF-TOKEN');
            cookies2.push(...cookies);
            return {
                cookie: cookies2,
                'X-CSRF-TOKEN': xcsrf,
            }
        }
    }

    async function getData(headers, siteId) {
        var urlencoded = new URLSearchParams();
        urlencoded.append("fieldId", siteId);
        urlencoded.append("timeUnit", "4");
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        var requestOptions = {
            method: 'POST',
            headers: headers,
            body: urlencoded,
        };
        let response = await fetch(DATA_URL, requestOptions)
        let data = cleanUpData(await response.arrayBuffer());
        return data;
    }

    function cleanUpData(arrayBuffer) {
        let decoder = new TextDecoder();
        let text = decoder.decode(arrayBuffer);
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
