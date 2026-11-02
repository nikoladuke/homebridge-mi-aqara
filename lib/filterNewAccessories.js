function filterNewAccessories(accessories, accessoryUtil) {
    var result = [];
    var seen = {};

    (accessories || []).forEach(function(accessory) {
        if (!accessory || !accessory.UUID || seen[accessory.UUID]) {
            return;
        }

        seen[accessory.UUID] = true;
        if (!accessoryUtil.getByUUID(accessory.UUID)) {
            result.push(accessory);
        }
    });

    return result;
}

module.exports = filterNewAccessories;
