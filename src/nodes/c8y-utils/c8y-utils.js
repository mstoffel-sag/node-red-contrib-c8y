// Will create a device and attach an external id with type if given
module.exports = async function createDeviceandAddExternalId(
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
    node.trace("createMoJson: " +  JSON.stringify(createMoJson));
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
        node.log("ExternalId: " + externalId + " attached to ManagedObject: " + id)
      } else {
        node.error("Could not create ExternalId: " +  resCreateExternal.status + " "+ resCreateExternal.statusText  )
        return "error";
      }
    }
    return id;
  } else {
    return "error";
  }
};
