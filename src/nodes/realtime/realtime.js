const c8yClientLib = require('@c8y/client');
const {getCredentials} = require("../c8y-utils/c8y-utils");

module.exports = function(RED) {
    function RealtimeNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.config = config;
        node.c8yconfig = RED.nodes.getNode(node.config.c8yconfig);
        getCredentials(RED, node);

        const topic = '/' + config.api + '/' + (config.deviceId || '*');
        node.log(
          `Subscribing to: ${topic} on tenant: ${node.C8Y_TENANT} and url: ${node.C8Y_BASEURL}`
        );
        const subscription = node.client.realtime.subscribe(topic, (evt) => {
            const msg = {
                payload: evt
            };
            node.send(msg);
        });

        node.on('close', function() {
            if (node.client && subscription) {
                node.client.realtime.unsubscribe(subscription);
            }
        });
    }
    RED.nodes.registerType("realtime", RealtimeNode);
    RED.httpAdmin.get("/realtimetoggel/:id", function (req, res) {
      node.log(JSON.stringify(res));
    });
}
