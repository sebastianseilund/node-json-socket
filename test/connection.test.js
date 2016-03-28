var assert = require('assert'),
    async = require('async'),
    net = require('net'),
    JsonSocket = require('../lib/json-socket'),
    helpers = require('./helpers');

describe('JsonSocket connection', function () {

    it('should connect, send and receive message', function (callback) {
        helpers.createServerAndClient(function (err, server, clientSocket, serverSocket) {
            if (err) return callback(err);
            assert.equal(clientSocket.isClosed(), false);
            assert.equal(serverSocket.isClosed(), false);
            async.parallel([
                function (callback) {
                    clientSocket.sendMessage({type: 'ping'}, callback);
                },
                function (callback) {
                    clientSocket.on('message', function (message) {
                        assert.deepEqual(message, {type: 'pong'});
                        callback();
                    });
                },
                function (callback) {
                    serverSocket.on('message', function (message) {
                        assert.deepEqual(message, {type: 'ping'});
                        serverSocket.sendMessage({type: 'pong'}, callback);
                    });
                }
            ], function (err) {
                if (err) return callback(err);
                assert.equal(clientSocket.isClosed(), false);
                assert.equal(serverSocket.isClosed(), false);
                helpers.closeServer(server, callback);
            });
        });
    });

    it('should send multiple messages', function (callback) {
        helpers.createServerAndClient(function (err, server, clientSocket, serverSocket) {
            if (err) return callback(err);
            async.parallel([
                function (callback) {
                    async.forEach(helpers.range(1, 100), function (i, callback) {
                        clientSocket.sendMessage({number: i}, callback);
                    }, callback);
                },
                function (callback) {
                    var lastNumber = 0;
                    serverSocket.on('message', function (message) {
                        assert.deepEqual(message.number, lastNumber + 1);
                        lastNumber = message.number;
                        if (lastNumber == 100) {
                            callback();
                        }
                    });
                }
            ], function (err) {
                if (err) return callback(err);
                helpers.closeServer(server, callback);
            });
        });
    });

    it('should send end message', function (callback) {
        helpers.createServerAndClient(function (err, server, clientSocket, serverSocket) {
            if (err) return callback(err);
            async.parallel([
                function (callback) {
                    clientSocket.sendEndMessage({type: 'ping'}, function (err) {
                        callback(err);
                    });
                },
                function (callback) {
                    serverSocket.on('message', function (message) {
                        assert.deepEqual(message, {type: 'ping'});
                        setTimeout(callback, 10);
                    });
                }
            ], function (err) {
                if (err) return callback(err);
                assert.equal(clientSocket.isClosed(), true);
                assert.equal(serverSocket.isClosed(), true);
                helpers.closeServer(server, callback);
            });
        });
    });

    it('should return true for isClosed() when server disconnects', function (callback) {
        helpers.createServerAndClient(function (err, server, clientSocket, serverSocket) {
            if (err) return callback(err);
            async.series([
                function (callback) {
                    serverSocket.end();
                    setTimeout(callback, 10);
                },
                function (callback) {
                    assert.equal(clientSocket.isClosed(), true);
                    assert.equal(serverSocket.isClosed(), true);
                    callback();
                }
            ], function (err) {
                if (err) return callback(err);
                helpers.closeServer(server, callback);
            });
        });
    });

    it('should return true for isClosed() when client disconnects', function (callback) {
        helpers.createServerAndClient(function (err, server, clientSocket, serverSocket) {
            if (err) return callback(err);
            async.series([
                function (callback) {
                    clientSocket.end();
                    setTimeout(callback, 10);
                },
                function (callback) {
                    assert.equal(clientSocket.isClosed(), true);
                    assert.equal(serverSocket.isClosed(), true);
                    callback();
                }
            ], function (err) {
                if (err) return callback(err);
                helpers.closeServer(server, callback);
            });
        });
    });

    it('send bulk messages through deferred', function (callback) {
        helpers.createServerAndClient(function (err, server, clientSocket, serverSocket) {
            if (err) return callback(err);
            async.parallel([
                function (callback) {
                    serverSocket.statistics();
                    var lastNumber = 0;
                    serverSocket.on('message', function () {
                        lastNumber++;
                        if (lastNumber == 10000) {
                            callback();
                        }
                    });
                },
                function (callback) {
                    async.forEach(helpers.range(1, 9999), function (i, callback) {
                        clientSocket.sendDeferred({number: i});
                        if (i === 9999) {
                            clientSocket.sendDeferred({number: 10000}, true);
                        }
                        callback();
                    }, callback);
                }
            ], function (err) {
                if (err) return callback(err);
                helpers.closeServer(server, callback);
            });
        });
    });

    it('send bulk messages through deferred with auto flush', function (callback) {
        console.log('ici');
        helpers.createServerAndClient(function (err, server, clientSocket, serverSocket) {
            if (err) return callback(err);
            async.parallel([
                function (callback) {
                    serverSocket.statistics();
                    var lastNumber = 0;
                    serverSocket.on('message', function (message) {
                        lastNumber++;
                        if (lastNumber == 10) {
                            callback();
                        }
                    });
                },
                function (callback) {
                    async.forEach(helpers.range(1, 10), function (i, callback) {
                        clientSocket.sendDeferred({number: i});
                        callback();
                    }, callback);
                }
            ], function (err) {
                if (err) return callback(err);
                helpers.closeServer(server, callback);
            });
        });
    });

//    it('should buffer message if sent before connected', function(callback) {
//        helpers.createServer(function(err, server) {
//            if (err) return callback(err);
//            var clientSocket = new JsonSocket(new net.Socket());
//            clientSocket.connect(server.address().port, '127.0.0.1');
//            clientSocket.on('error', function(err) {
//                callback(err);
//            });
//            async.parallel([
//                function(callback) {
//                    clientSocket.sendMessage({type: 'ping'}, callback);
//                },
//                function(callback) {
//                    server.on('connection', function(socket) {
//                        var serverSocket = new JsonSocket(socket);
//                        serverSocket.on('message', function(message) {
//                            assert.deepEqual(message, {type: 'ping'});
//                            callback();
//                        });
//                    });
//                }
//            ], function(err) {
//                if (err) return callback(err);
//                helpers.closeServer(server, callback);
//            });
//        });
//    });

});