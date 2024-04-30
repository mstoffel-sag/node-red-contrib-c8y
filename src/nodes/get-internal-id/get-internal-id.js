const c8yClientLib = require('@c8y/client');
const createDeviceandAddExternalId = require("../c8y-utils/c8y-utils");
const util = require("util");

module.exports = function(RED) {
    function GetInternalIdCallNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.config = config;
        const {C8Y_TENANT,C8Y_BASEURL, C8Y_USER,C8Y_PASSWORD} = process.env;
        const auth = new c8yClientLib.BasicAuth({tenant: C8Y_TENANT, user: C8Y_USER, password: C8Y_PASSWORD});

        node.on('input', async function(msg) {
          node.client = new c8yClientLib.Client(auth, C8Y_BASEURL);
          node.client.core.tenant = C8Y_TENANT;
          
          try {
            // Get properties
            externalIdType = RED.util.evaluateNodeProperty(
              node.config.externalidtype,
              node.config.externalidtypeType,
              node,
              msg
            );
            externalId = RED.util.evaluateNodeProperty(
              node.config.externalid,
              node.config.externalidType,
              node,
              msg
            );
            params = RED.util.evaluateNodeProperty(
              node.config.params,
              node.config.paramsType,
              node,
              msg
            );
          } catch (error) {
            node.error("Extracting Properties " +error);
            return;
          }

          node.debug("Config: externalId: " + externalId +  " externalIdType: " + externalIdType )
          
          if (externalId === undefined) {
            node.error( "Error externalId is undefined.");
            return;
          }
          if (externalIdType === undefined) {
            node.error( "Error externalIdType is undefined.");
            return;
          }
          const fetchOptions = {
            method: "GET",
            body: undefined,
            headers: msg.headers || {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          };
          //Get internalId from external
          const res = await node.client.core.fetch(
            "/identity/externalIds/" + externalIdType + "/" + externalId,
            fetchOptions
          );
          node.trace(
            "Get InternalId Response: " + util.inspect(res, { depth: null })
          );
          msg.status = res.status;
          delete msg.body;
          delete msg.headers;
          if (msg.status == 200) {
            try {
              json = await res.json();
              msg.payload = json.managedObject.id;
              node.send(msg);
            } catch (error) {
              node.error(error);
              return;
            }
          } else {
            if (msg.status == 404) {
              if (node.config.createdevice) {
                // create deivce
                if (params === undefined) {
                  var mo = {
                    c8y_IsDevice: {},
                    name: "Node-Red-Device-" + externalId,
                  };
                } else {
                  var mo = {
                    c8y_IsDevice: {},
                    ...params,
                  };
                }
                node.debug("ManagedObject to create: ", mo);
                msg.payload = await createDeviceandAddExternalId(
                  node,
                  mo,
                  externalId,
                  externalIdType
                );
                node.log("Internal Id: " + msg.payload);
                if (typeof msg.payload != "error") {
                  node.send(msg);
                  return;
                } else {
                  node.error("ExternalId not found: " + error);
                  return;
                }
              }else{
              node.error("Get InternalId Response: " + res.status + " " + res.statusText);
              return;
              }
            }
          }
      });
    }
    RED.nodes.registerType("get-internal-id", GetInternalIdCallNode);
}

