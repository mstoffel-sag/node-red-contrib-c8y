const c8yClientLib = require('@c8y/client');
const {getCredentials} = require("../c8y-utils/c8y-utils");
const Websocket = require("ws");
const uuid = require("uuid");

module.exports = function(RED) {
    function notificationNode(config) {
      RED.nodes.createNode(this, config);
      var node = this;
      node.config = config;

      node.subscriber = node.config.subscriber;
      node.c8yconfig = RED.nodes.getNode(node.config.c8yconfig);
      node.active =
        config.active === null ||
        typeof config.active === "undefined" ||
        config.active;
      node.socket = undefined;
      node.clientId = "nodeRed" + uuid.v4().replace(/-/g, "");
      node.reconnectTimeout = 10000;
      node.pingInterval = 50000;
      node.heartBeatReference = undefined;
      node.refreshTokenIntervalReference = undefined;
      node.reconnectCount = 0;
      node.expiresInMinutes = 10;
      node.refreshTokenInterval = (node.expiresInMinutes - 1) * 1000 * 60;
      node.token = undefined;
      getCredentials(RED, node);
          node.subscription = RED.util.evaluateNodeProperty(
            node.config.subscription,
            node.config.subscriptionType,
            node,
            undefined
          );
      // node.on('input', function(msg) {
      //   try {
      //     node.subscription = RED.util.evaluateNodeProperty(
      //       node.config.subscription,
      //       node.config.subscriptionType,
      //       node,
      //       msg
      //     );
      //   }catch(e){
      //     node.error(e);
      //     return;
      //   }
      // });
      // }
      node.subscribeWS = async () => {
        await node.getToken();
        node.refreshTokenIntervalReference = setInterval(async () => {
          node.debug("Refresh Token");
          await node.getToken();
        }, node.refreshTokenInterval);

        node.status({
          fill: "green",
          shape: "ring",
          text: "Connecting...",
        });

        url = `wss://${node.C8Y_BASEURL.replace(
          /(^\w+:|^)\/\//,
          ""
        )}/notification2/consumer/?token=${node.token}`;
        node.socket = new Websocket(url);

        node.socket.clientId = node.clientId;
        node.socket.onopen = function (e) {
          node.reconnectCount = 0;
          node.debug("[ws open] Connection established.");
          node.status({
            fill: "green",
            shape: "dot",
            text: "Connected",
          });
          node.heartBeatReference = setInterval(() => {
            node.socket.ping();
            node.debug("Ping!");
          }, node.pingInterval);
          node.socket.onmessage = function (event) {
            message = event.data.split("\n");
            const id = message[0];
            const source = message[1];
            const operation = message[2];
            const payload = message[4];
            node.debug(
              `New Notification id: ${id} source: ${source} operation: ${operation} \n payload: ${payload}`
            );
            const msg = {
              payload: {
                id: id,
                source: source,
                operation: operation,
                message: JSON.parse(payload),
              },
            };
            node.send(msg);
            // Ack message
            node.socket.send(id);
          };
          node.socket.addEventListener("ping", (event) => {
            console.log("Ping from server ", event.data);
          });
          node.socket.addEventListener("pong", (event) => {
            console.log("Pong from server ", event.data);
          });
        };

        node.socket.onclose = function (event) {
          clearInterval(node.heartBeatReference);
          node.status({
            fill: "red",
            shape: "dot",
            text: `Disconnected: code=${event.code} ${event.reason}`,
          });
          node.debug(`[ws close] code=${event.code} reason=${event.reason}`);
          if (event.code !== 1000) {
            setTimeout(function () {
              node.debug(`Reconnecting.....${node.reconnectCount}`);
              node.reconnectCount = ++node.reconnectCount;
              node.subscribeWS();
            }, node.reconnectTimeout);
          }
        };

        node.socket.onerror = function (error) {
          node.error(
            `[error] ${JSON.stringify(error)} ${node.socket.readyState}`
          );

          node.status({
            fill: "red",
            shape: "dot",
            text: `Error: ${error.code}`,
          });
        };
      };

      node.getToken = async function () {
        node.log(
          `Get Token: Subscription: ${node.subscription}  Subscriber: ${node.subscriber}`
        );
        if (node.subscriber !== undefined && node.subscription != undefined) {
          const fetchOptions = {
            method: "POST",
            body: JSON.stringify({
              subscription: node.subscription,
              subscriber: node.subscriber,
              expiresInMinutes: node.expiresInMinutes,
            }),
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          };
          let c8yres = undefined;
          try {
            c8yres = await node.client.core.fetch(
              "notification2/token",
              fetchOptions
            );
          } catch (error) {
            node.error(error);
            return;
          }
          if (c8yres.status == 200) {
            try {
              json = await c8yres.json();
              node.debug("Token received");
              node.token = json.token;
              return;
            } catch (error) {
              node.error(error);
              return;
            }
          } else {
            node.error(c8yres.status);
            return;
          }
        } else {
          node.error("Subscriber, Subscription was undefined");
        }
      };

      node.unsubscribeNotification = function () {
        if (node.socket !== undefined) {
          clearInterval(node.heartBeatReference);
          clearInterval(node.refreshTokenIntervalReference);
          node.log("Closing ws connection");
          node.socket.close(1000, "Node Deactivated");
          node.socket = undefined;
        }
      };

      node.subscribeNotification = async function () {
        node.subscribeWS();
      };

      setNodeState(node, true);

      node.on("close", function () {
        node.debug("Npde CLOSE");
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

    // Register Node
    RED.nodes.registerType("notification", notificationNode);

    // Manage State
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
