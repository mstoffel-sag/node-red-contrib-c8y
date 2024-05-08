const c8yClientLib = require('@c8y/client');
const {getCredentials} = require("../c8y-utils/c8y-utils");
const WebSocket = require("ws");

module.exports = function(RED) {
    function notificationNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.config = config;
        node.subscription = config.subscription;
        node.subscriber = node.config.subscriber;
        node.c8yconfig = RED.nodes.getNode(node.config.c8yconfig);
        node.active = config.active === null || typeof config.active === "undefined" || config.active;
        getCredentials(RED, node);
        node.log("node.active: " + node.active);
        console.log(node.C8Y_BASEURL);
        

        node.subscribeWS = (token)=>{
            token =
              'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJkZiIsInRvcGljIjoidDE1MjY0OTcxL3JlbG5vdGlmL0R5bmFtaWNNYXBwZXJUZW5hbnRTdWJzY3JpcHRpb24iLCJqdGkiOiJhODI3MGRiMC03ZTViLTQzZGMtYjgxNC1jYTE1Y2ZlNzc3OTAiLCJpYXQiOjE3MTUxODAyODQsImV4cCI6MTcyMTE4MDI4NH0.eK8SpBu0GTjeC1KFprjvpyyOGB_MLMI4n5PWxeHk_Ak0JZ-9SwujtDBj8W7w-XW5x2HX82REXb2fDcfUvwZ0UuUJ1zmwoJELfYK_d-63O64WK2kmNfutR3O1qUbJWy6d7YEeMhVTZLw6SWz6RXGyJw0coRSt6m5b8JR2hRmLqS_Fi0H26XCQ7XtUsChN1McyiQwcVYDmcpGFTN_V9FWJiFgJbObqSNmBTKCD36ZnEZLyfonzFSa9zIHXNjfpcS-ovf4WlDICXh1WyPS4-c57oCu-stcabIY3VjoSV8UzQTrh8yXKPBcmZtWZa2duyWgnjr9wMlU-JIoiKFXE7Ie2Lg';
            url =
              "ws:" +
              node.C8Y_BASEURL.replace(/(^\w+:|^)\/\//, "") +
              "/notification2/consumer/?token=" +
              token;
            console.log("url: " ,url );
            let socket = new WebSocket(url);
            console.log("socket: " ,socket);
            socket.onopen = function (e) {
              node.debug("[open] Connection established");
            };
            socket.onmessage = function (event) {
              node.debug(`[message] : ${event.data}`);
            };

            socket.onclose = function (event) {
              if (event.wasClean) {
                node.debug(
                  `[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`
                );
              } else {
                // e.g. server process killed or network down
                // event.code is usually 1006 in this case
                node.debut("[close] Connection died");
              }
            };

            socket.onerror = function (error) {
              node.error(`[error]`);
            };
           
        }
          node.subscribeWS = (token) => {
            token =
              "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJkZiIsInRvcGljIjoidDE1MjY0OTcxL3JlbG5vdGlmL0R5bmFtaWNNYXBwZXJUZW5hbnRTdWJzY3JpcHRpb24iLCJqdGkiOiJhODI3MGRiMC03ZTViLTQzZGMtYjgxNC1jYTE1Y2ZlNzc3OTAiLCJpYXQiOjE3MTUxODAyODQsImV4cCI6MTcyMTE4MDI4NH0.eK8SpBu0GTjeC1KFprjvpyyOGB_MLMI4n5PWxeHk_Ak0JZ-9SwujtDBj8W7w-XW5x2HX82REXb2fDcfUvwZ0UuUJ1zmwoJELfYK_d-63O64WK2kmNfutR3O1qUbJWy6d7YEeMhVTZLw6SWz6RXGyJw0coRSt6m5b8JR2hRmLqS_Fi0H26XCQ7XtUsChN1McyiQwcVYDmcpGFTN_V9FWJiFgJbObqSNmBTKCD36ZnEZLyfonzFSa9zIHXNjfpcS-ovf4WlDICXh1WyPS4-c57oCu-stcabIY3VjoSV8UzQTrh8yXKPBcmZtWZa2duyWgnjr9wMlU-JIoiKFXE7Ie2Lg";
            url =
              "wss://" +
              node.C8Y_BASEURL.replace(/(^\w+:|^)\/\//, "") +
              "/notification2/consumer/?token=" +
              token;
            console.log("url: ", url);
            let socket = new WebSocket(url);
            console.log("socket: ", socket);
            socket.onopen = function (e) {
              node.debug("[open] Connection established");
            };

            socket.onmessage = function (event) {
              node.debug(`[message] : ${event.data}`);
            };

            socket.onclose = function (event) {
              if (event.wasClean) {
                node.debug(
                  `[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`
                );
              } else {
                // e.g. server process killed or network down
                // event.code is usually 1006 in this case
                node.debut("[close] Connection died");
              }
            };

            socket.onerror = function (error) {
              node.error(`[error]`);
            };
          };


        node.subscribeNotification = async function () {
          node.log(
            `${node.subscriber} subscribing to ${node.subscription} on tenant: ${node.C8Y_TENANT} and url: ${node.C8Y_BASEURL}`
            );
            node.subscribeWS();
            if (node.subscriber !== undefined && node.subscription) {

            const fetchOptions = {
              method: "POST",
              body: {
                subscription: node.subscription,
                subscriber: node.subscriber,
                expiresInMinutes :"1000000"
              },
              headers:  {
                "Content-Type": "application/json",
                "Accept": "application/json",
              }
            };

            node.log("get Token:" + JSON.stringify(fetchOptions));
            //console.log("node.client:" ,node.client);
            const c8yres = await node.client.core.fetch(
              "/notification2/token",
              fetchOptions
            );
            console.log("c8yres:"  ,c8yres);
            if (c8yres.status == 200) {
              try {
                json = await c8yres.json();
                node.log("token: " + JSON.stringify(json));
                node.
                return;
              } catch (error) {
                node.error(error);
                return;
              }
            }else{
               node.error(c8yres.status);
               return;
            }
          }
          
        }

      
        node.unsubscribeNotification = function () {
         node.log(`${node.subscriber} unsubscribing from ${node.subscription} on tenant: ${node.C8Y_TENANT} and url: ${node.C8Y_BASEURL}`)
        }

        setNodeState(node, true);

        node.on('close', function() {
            node.log("on CLOSE");
            node.unsubscribenotification();
        });
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
}
