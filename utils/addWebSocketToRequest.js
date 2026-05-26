const addWebSocketToRequest = (wss) => (req, res, next) => {
    req.wss = wss;
    next();
};

module.exports = addWebSocketToRequest;
