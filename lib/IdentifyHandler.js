function attachIdentifyHandler(accessory, log) {
    accessory.on('identify', function(paired, callback) {
        log.debug(accessory.displayName + " Identify!!!");
        if (typeof callback === 'function') {
            callback();
        }
    });
}

module.exports = attachIdentifyHandler;
