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
      node.socket = undefined;
      node.clientId = "nodeRed" + uuid.v4().replace(/-/g, "");
      node.reconnectTimeout = 10000;
      node.pingInterval = 180000;
      node.heartBeatReference = undefined;
      node.refreshTokenIntervalReference = undefined;
      node.reconnectCount = 0;
      node.expiresInMinutes = 10;
      node.refreshTokenInterval = (node.expiresInMinutes - 1) * 1000 * 60;
      node.token = undefined;
      getCredentials(RED, node);
      
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
            `[error] ${JSON.stringify(error)} ${node.socket.readyState !== undefined ? node.socket.readyState : ""}`
          );

          node.status({
            fill: "red",
            shape: "dot",
            text: `Error: ${error.code}`,
          });
        };
      };

      node.getToken = async function () {
        node.debug(
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

      setNodeState(node, node.config.active);

      node.on("close", function () {
        node.debug("Npde CLOSE");
        node.unsubscribeNotification();
      });
    }

    // Manage node state
    function setNodeState(node,state) {
        if (state) {
            
            node.subscription = RED.util.evaluateNodeProperty(
              node.config.subscription,
              node.config.subscriptionType,
              node,
              undefined
            );

            node.log(
              "Activating Subscription: " +
                node.subscription +
              " Subscriber: " + node.subscriber
            );

            if (node.subscriber && node.subscription && node.subscription !=="nosub"){
              node.subscribeNotification();
              node.config.active = true;
            }else{
              node.error("Missing config. Subscriber or Subscription not configured.")
              node.config.active = false;
            }
        } else {
            node.config.active = false;
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
        const cmd= req.params.cmd;
        const id= req.params.id;
        console.log(`/notification/${id}/${cmd}`);
        if ( !id || !cmd) {
          console.log(`/notification id or cmd undefined`);
          res.sendStatus(404);
          return;
        }

        const node = RED.nodes.getNode(id);
        if (node) {
          node.debug(`Current Node State  ${node.config.active}  Command:  ${cmd}` );
        }else{
          console.error("Node not found");
          res.sendStatus(404);
          return;
        }
        // Manage Node State
        if (cmd == "enable" || cmd == "disable") {
          if (node !== null && typeof node !== "undefined") {
            setNodeState(node, cmd === "enable");
            res.sendStatus(cmd === "enable" ? 200 : 201);
          } else {
            res.sendStatus(404);
            return;
          }

          //
        } else if (cmd == "getSubscriptions" && node &&  node.c8yconfig ) {
          if (!node.client) {
            getCredentials()
          }
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
