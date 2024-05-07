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
             try {
               getCredentials(RED, node);
               // Get properties
               body = RED.util.evaluateNodeProperty(
                 node.config.body,
                 node.config.bodyType,
                 node,
                 msg
               );
               method = RED.util.evaluateNodeProperty(
                 node.config.method,
                 node.config.methodType,
                 node,
                 msg
               );
               // please no body for GET
               body = method ==="GET" ? undefined : body;
               endpoint = RED.util.evaluateNodeProperty(
                 node.config.endpoint,
                 node.config.endpointType,
                 node,
                 msg
               );
               node.debug(
                 "Config: " +
                   node.C8Y_TENANT +
                   " " +
                   node.C8Y_BASEURL +
                   " endpoint: " +
                   endpoint
               );
             } catch (error) {
               node.error("Extracting Properties " + error);
               return;
             }
        const fetchOptions = {
          method: method,
          body: JSON.stringify(body) || undefined,
          headers: msg.headers || {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        };
        node.debug("Fetching: " + JSON.stringify(fetchOptions) + " Endpoint: " + endpoint);
        node.client.core
          .fetch(endpoint, fetchOptions)
          .then(
            (res) => {
              msg.status = res.status;
              delete msg.body;
              delete msg.headers;
              return res.json().then(
                (json) => {
                  node.debug("res:" + json);
                  msg.payload = json;
                  node.send(msg);
                },
                (error) => {
                  node.error(error);
                }
              );
            },
            (error) => {
              node.error(error);
            }
          );
      });
    }
    RED.nodes.registerType("call-endpoint", EndpointCallNode);
}
