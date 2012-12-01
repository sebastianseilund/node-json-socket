var net = require('net'),
    async = require('async'),
    JsonSocket = require('../lib/json-socket');

function createServer(callback) {
    var server = net.createServer();
    server.listen();
    server.on('listening', function() {
        callback(null, server);
    });
    server.on('error', function (err) {
        callback(err);
    });
}
function closeServer(server, callback) {
    server.close();
    callback();
}
function createClient(server, callback) {
    var clientSocket = new JsonSocket(new net.Socket());
    clientSocket.connect(server.address().port, '127.0.0.1');
    clientSocket.on('error', function(err) {
        callback(err);
    });
    server.once('connection', function(socket) {
        var serverSocket = new JsonSocket(socket);
        callback(null, clientSocket, serverSocket);
    });
}
function createServerAndClient(callback) {
    createServer(function(err, server) {
        if (err) return callback(err);
        createClient(server, function(err, clientSocket, serverSocket) {
            if (err) return callback(err);
            callback(null, server, clientSocket, serverSocket);
        });
    });
}

function range(start, end) {
    var r = [];
    for (var i = start; i <= end; i++) {
        r.push(i);
    }
    return r;
}

module.exports = {
    createServer: createServer,
    closeServer: closeServer,
    createClient: createClient,
    createServerAndClient: createServerAndClient,
    range: range
};