const c8yClientLib = require('@c8y/client');
const {getCredentials} = require("../c8y-utils/c8y-utils");
const Websocket = require("ws");

module.exports = function(RED) {
    function notificationNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.config = config;
        node.subscription = config.subscription;
        node.subscriber = node.config.subscriber;
        node.c8yconfig = RED.nodes.getNode(node.config.c8yconfig);
        node.active = config.active === null || typeof config.active === "undefined" || config.active;
        node.socket = undefined;
        getCredentials(RED, node);
        node.log("node.active: " + node.active);
        console.log(node.C8Y_BASEURL);
        console.log("Client; " , node.client);
 

        subscribeWS = (token,timeout) => {
            node.debug("subscribeWS", token);
            url =
            "wss://" +
            node.C8Y_BASEURL.replace(/(^\w+:|^)\/\//, "") +
            "/notification2/consumer/?token=" + token;
            console.log("url: ", url);
            node.socket = new Websocket(url);
            //console.log("node.socket: ", node.socket);
            node.socket.onopen = function (e) {
              node.debug("[open] Connection established");
            };

            node.socket.onmessage = function (event) {

              message = event.data.split('\n');
              const id = message[0];
              const source = message[1];
              const operation = message[2];
              const payload = message[4];
              node.debug(`New Notification id: ${id} source: ${source} operation: ${operation} \n payload: ${payload}`);
              const msg = {
                payload: {
                  id: id,
                  source: source,
                  operation: operation,
                  message: JSON.parse(payload)
                },
              };
              node.send(msg);
              node.socket.send(id);
            };

            node.socket.onclose = function (event) {
              if (event.wasClean) {
                node.debug(
                  `[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`
                );
              } else {
                // e.g. server process killed or network down
                // event.code is usually 1006 in this case
                node.debug("[close] Connection died. Reconnecting.");
              }
              if (event.code !== 1000) {
                node.debug("Reconnecting!");
                setTimeout(function () {
                  connect();
                }, timeout);
              } else {
                node.log("Closing finished");
              }
            };
            node.socket.onerror = function (error) {
              node.error(`[error] ${error}`);
            };
        };

        node.getToken = async function (
          subscriber,
          subscription,
          expiresInMinutes
        ) {
          node.log(
            `${subscriber} subscribing to ${subscription} on tenant: ${node.C8Y_TENANT} and url: ${node.C8Y_BASEURL}`
          );
          if (subscriber !== undefined && subscription != undefined) {
            const fetchOptions = {
              method: "POST",
              body: JSON.stringify({
                subscription: subscription,
                subscriber: subscriber,
                expiresInMinutes: expiresInMinutes,
              }),
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            };
            const c8yres = await node.client.core.fetch(
              "notification2/token",
              fetchOptions
            );
            if (c8yres.status == 200) {
              try {
                json = await c8yres.json();
                return json.token;
              } catch (error) {
                node.error(error);
                return;
              }
            } else {
              node.error(c8yres.status);
              return;
            }
          }
        };

      
        node.unsubscribeNotification = function () {
          if (node.socket !== undefined) {
            node.log("Closing")
            node.socket.close(1000,"Node Deactivated");
            node.socket= undefined;
          }
        }
        node.subscribeNotification = async function () {
         const token = await node.getToken(node.subscriber, node.subscription, 100000);
         subscribeWS(token,1000);
        }

        setNodeState(node, true);

        node.on('close', function() {
            node.log("on CLOSE");
            node.unsubscribeNotification();
        });
    }

        // Manage node state
    function setNodeState(node,state) {
        if (state) {
            node.active = true;
            node.subscribeNotification();
        } else {
            node.active = false;
            node.unsubscribeNotification();
        }
    }

    RED.nodes.registerType("notification", notificationNode);

    // State
    RED.httpAdmin.get(
      "/notification/:id/:cmd",
      RED.auth.needsPermission("notification.write"),
      async function (req, res) {
        console.log(
          "id: " + req.params.id + " cmd: " + req.params.cmd
        );
        if (req.params.cmd == undefined || req.params.id == undefined) {
          res.sendStatus(404);
          return;
        }

        var cmd= req.params.cmd;
        var id= req.params.id;
        var node = RED.nodes.getNode(req.params.id);
        // console.log("/notification/ node.config:" , node.c8yconfig);
        // console.log("/notification/ node.client:" , node.client);
        // Manage Node State
        if (cmd == "enable" || cmd == "disable") {
          if (node !== null && typeof node !== "undefined") {
            setNodeState(node, cmd === "enable");
            res.sendStatus(cmd === "enable" ? 200 : 201);
          } else {
            res.sendStatus(404);
          }

          //
        } else if (cmd == "getSubscriptions" && node!==undefined && node!==null && node.c8yconfig !==undefined && node.client !== undefined) {
          const fetchOptions = {
            method: "GET",
            body: undefined,
            headers:  {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          };
          //Get subscriptions from external
          if (node.client == undefined) {
            res.sendStatus(404);
            return;
          }
          const c8yres = await node.client.core.fetch(
            "/notification2/subscriptions",
            fetchOptions
          );
          if (c8yres.status == 200) {
            try {
              json = await c8yres.json();
              res.json(json);
              //res.sendStatus(c8yres.status);
              return;
            } catch (error) {
              node.error(error);
              res.sendStatus(res.status);
              return;
            }
          }
        } else {
          res.sendStatus(404);
        }
      }
    );

}
