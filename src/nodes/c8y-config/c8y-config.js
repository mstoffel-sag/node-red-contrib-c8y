const c8yClientLib = require('@c8y/client');
const createDeviceandAddExternalId = require("../c8y-utils/c8y-utils");
const util = require("util");

module.exports = function(RED) {
    function GetInternalIdCallNode(config) {
        RED.nodes.createNode(this,config);
        this.c8ytenant = config.c8ytenant;
        this.c8yurl = config.c8yurl;
        this.c8ytenant = config.c8ytenant;
        this.c8ytenant = config.c8ytenant;
    }
    RED.nodes.registerType("c8y-config", GetInternalIdCallNode);
}

