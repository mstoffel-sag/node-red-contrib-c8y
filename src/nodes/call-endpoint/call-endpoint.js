const {
  createDeviceandAddExternalId,
  getCredentials,
} = require("../c8y-utils/c8y-utils");

module.exports = function(RED) {
    function EndpointCallNode(config) {
      RED.nodes.createNode(this, config);
      var node = this;
      node.config = config;
      node.c8yconfig = RED.nodes.getNode(node.config.c8yconfig);
      node.on("input", function (msg) {
        getCredentials(RED, node);
        const fetchOptions = {
          method: msg.method || config.method || "GET",
          body: JSON.stringify(msg.body || config.body) || undefined,
          headers: msg.headers || {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        };
        node.client.core
          .fetch(msg.endpoint || config.endpoint, fetchOptions)
          .then(
            (res) => {
              msg.status = res.status;
              delete msg.body;
              delete msg.headers;
              return res.json().then(
                (json) => {
                  msg.payload = json;
                  node.send(msg);
                },
                (error) => {
                  msg.paylaod = error;
                  node.send(msg);
                }
              );
            },
            (error) => {
              msg.paylaod = error;
              node.send(msg);
            }
          );
      });
    }
    RED.nodes.registerType("call-endpoint", EndpointCallNode);
}
