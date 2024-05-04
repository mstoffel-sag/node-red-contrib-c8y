const c8yClientLib = require("@c8y/client");

// Will create a device and attach an external id with type if given
let createDeviceandAddExternalId = async function createDeviceandAddExternalId(
  node,
  mo,
  externalId,
  type
) {
  const fetchOptions = {
    method: "POST",
    body: JSON.stringify(mo),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
  //Create Device
  const resCreateMo = await node.client.core.fetch(
    "/inventory/managedObjects",
    fetchOptions
  );
  try {
    createMoJson = await resCreateMo.json();
  } catch (error) {
    node.error(error);
    return "error";
  }
  let id = "";
  if (resCreateMo.status == 201) {
    node.trace("createMoJson: " + JSON.stringify(createMoJson));
    id = createMoJson.id;
    fetchOptions.body = JSON.stringify({
      externalId: externalId,
      type: type,
    });
    // Create External id
    if (externalId !== undefined) {
      const resCreateExternal = await node.client.core.fetch(
        "/identity/globalIds/" + id + "/externalIds",
        fetchOptions
      );
      try {
        createExtJson = await resCreateExternal.json();
      } catch (error) {
        node.error(error);
        return "error";
      }
      node.trace("createExtJson: " + JSON.stringify(createExtJson));
      if (resCreateExternal.status == 201) {
        node.log(
          "ExternalId: " + externalId + " attached to ManagedObject: " + id
        );
      } else {
        node.error(
          "Could not create ExternalId: " +
            resCreateExternal.status +
            " " +
            resCreateExternal.statusText
        );
        return "error";
      }
    }
    return id;
  } else {
    return "error";
  }
};

let getCredentials = function getCredentials(RED, node) {
  if (node.config.useenv === true) {
    node.C8Y_TENANT = process.env.C8Y_TENANT;
    node.C8Y_BASEURL = process.env.C8Y_BASEURL;
    node.C8Y_USER = process.env.C8Y_USER;
    node.C8Y_PASSWORD = process.env.C8Y_PASSWORD;
  } else {
    
    if (node.c8yconfig) {
      node.C8Y_TENANT = node.c8yconfig.c8ytenant;
    } else {
      node.error("No config found");
      return;
    }
    node.C8Y_TENANT = node.c8yconfig.c8ytenant;
    node.C8Y_BASEURL = node.c8yconfig.c8yurl;
    node.C8Y_USER = node.c8yconfig.credentials.c8yuser;
    node.C8Y_PASSWORD = node.c8yconfig.credentials.c8ypassword;
  }
  const auth = new c8yClientLib.BasicAuth({
    tenant: node.C8Y_TENANT,
    user: node.C8Y_USER,
    password: node.C8Y_PASSWORD,
  });
  node.client = new c8yClientLib.Client(auth, node.C8Y_BASEURL);
  node.client.core.tenant = node.C8Y_TENANT.tenant;
};
module.exports = {
  createDeviceandAddExternalId,
  getCredentials,
};
