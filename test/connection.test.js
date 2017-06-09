var assert = require('assert'),
    async = require('async'),
    net = require('net'),
    JsonSocket = require('../lib/json-socket'),
    helpers = require('./helpers'),
    longPayload = require('./data/long-payload-with-special-chars.json');

describe('JsonSocket connection', function() {
    it('should connect, send and receive message', function(done) {
        helpers.createServerAndClient(function(err, server, clientSocket, serverSocket) {
            if (err) return done(err);
            assert.equal(clientSocket.isClosed(), false);
            assert.equal(serverSocket.isClosed(), false);
            async.parallel([
                function(callback) {
                    clientSocket.sendMessage({type: 'ping'}, callback);
                },
                function(callback) {
                    clientSocket.on('message', function(message) {
                        assert.deepEqual(message, {type: 'pong'});
                        callback();
                    });
                },
                function(callback) {
                    serverSocket.on('message', function(message) {
                        assert.deepEqual(message, {type: 'ping'});
                        serverSocket.sendMessage({type: 'pong'}, callback);
                    });
                }
            ], function(err) {
                if (err) return done(err);
                assert.equal(clientSocket.isClosed(), false);
                assert.equal(serverSocket.isClosed(), false);
                helpers.closeServer(server, done);
            });
        });
    });

    it('should send long messages with special characters without issues', function(done) {
        helpers.createServerAndClient(function(err, server, clientSocket, serverSocket) {
            if (err) return done(err);
            assert.equal(clientSocket.isClosed(), false);
            assert.equal(serverSocket.isClosed(), false);
            async.parallel([
                function(callback) {
                    clientSocket.sendMessage(longPayload, callback);
                },
                function(callback) {
                    clientSocket.on('message', function(message) {
                        assert.deepEqual(message, {type: 'pong'});
                        callback();
                    });
                },
                function(callback) {
                    serverSocket.on('message', function(message) {
                        assert.deepEqual(message, longPayload);
                        serverSocket.sendMessage({type: 'pong'}, callback);
                    });
                }
            ], function(err) {
                if (err) return done(err);
                assert.equal(clientSocket.isClosed(), false);
                assert.equal(serverSocket.isClosed(), false);
                helpers.closeServer(server, done);
            });
        });
    });

    it('should send multiple messages', function(done) {
        helpers.createServerAndClient(function(err, server, clientSocket, serverSocket) {
            if (err) return done(err);
            async.parallel([
                function(callback) {
                    async.forEach(helpers.range(1, 100), function(i, callback) {
                        clientSocket.sendMessage({number: i}, callback);
                    }, callback);
                },
                function(callback) {
                    var lastNumber = 0;
                    serverSocket.on('message', function(message) {
                        assert.deepEqual(message.number, lastNumber + 1);
                        lastNumber = message.number;
                        if (lastNumber == 100) {
                            callback();
                        }
                    });
                }
            ], function(err) {
                if (err) return done(err);
                helpers.closeServer(server, done);
            });
        });
    });

    it('should send end message', function(done) {
        helpers.createServerAndClient(function(err, server, clientSocket, serverSocket) {
            if (err) return done(err);
            async.parallel([
                function(callback) {
                    clientSocket.sendEndMessage({type: 'ping'}, function(err) {
                        callback(err);
                    });
                },
                function(callback) {
                    serverSocket.on('message', function(message) {
                        assert.deepEqual(message, {type: 'ping'});
                        setTimeout(callback, 10);
                    });
                }
            ], function(err) {
                if (err) return done(err);
                assert.equal(clientSocket.isClosed(), true);
                assert.equal(serverSocket.isClosed(), true);
                helpers.closeServer(server, done);
            });
        });
    });

    it('should return true for isClosed() when server disconnects', function(done) {
        helpers.createServerAndClient(function(err, server, clientSocket, serverSocket) {
            if (err) return done(err);
            async.series([
                function(callback) {
                    serverSocket.end();
                    setTimeout(callback, 10);
                },
                function(callback) {
                    assert.equal(clientSocket.isClosed(), true);
                    assert.equal(serverSocket.isClosed(), true);
                    callback();
                }
            ], function(err) {
                if (err) return done(err);
                helpers.closeServer(server, done);
            });
        });
    });

    it('should return true for isClosed() when client disconnects', function(done) {
        helpers.createServerAndClient(function(err, server, clientSocket, serverSocket) {
            if (err) return done(err);
            async.series([
                function(callback) {
                    clientSocket.end();
                    setTimeout(callback, 10);
                },
                function(callback) {
                    assert.equal(clientSocket.isClosed(), true);
                    assert.equal(serverSocket.isClosed(), true);
                    callback();
                }
            ], function(err) {
                if (err) return done(err);
                helpers.closeServer(server, done);
            });
        });
    });

    it('should return true for isClosed() when client (re)connects', function(done) {
        var server = net.createServer();
        server.listen();
        server.on('listening', function() {
            var clientSocket = new JsonSocket(new net.Socket());

            server.once('connection', function(socket) {
                var serverSocket = new JsonSocket(socket);
                serverSocket.on('end', function() {
                    setTimeout(function() {
                        assert.equal(serverSocket.isClosed(), true);
                        assert.equal(clientSocket.isClosed(), true);
                        clientSocket.on('connect', function() {
                            setTimeout(function() {
                                assert.equal(clientSocket.isClosed(), false);
                                done();
                            }, 10);
                        });
                        clientSocket.connect(server.address().port, '127.0.0.1');
                    }, 10);
                });

                clientSocket.end();
            });

            clientSocket.connect(server.address().port, '127.0.0.1');
        });
    });

    it('should send message when forth argument sendSingleMessage is function', function (done) {
        var server = net.createServer();
        server.listen();
        server.on('listening', function() {
            server.once('connection', function(socket) {
                var serverSocket = new JsonSocket(socket);
                serverSocket.on('message', function(message) {
                    assert.equal(message, 'test');
                });
            });
            JsonSocket.sendSingleMessage(server.address().port, '127.0.0.1', 'test', function(err){
                assert.equal(err, null);
                done();
            });
        });
    });

    it('should send message when forth argument sendSingleMessage is object with custom delimeter', function (done) {
        var server = net.createServer();
        server.listen();
        server.on('listening', function() {
            server.once('connection', function(socket) {
                var serverSocket = new JsonSocket(socket, { delimeter: "¡"});
                serverSocket.on('message', function(message) {
                    assert.equal(message, 'test');
                });
            });
            JsonSocket.sendSingleMessage(server.address().port, '127.0.0.1', 'test', { delimeter: "¡"}, function(err){
                assert.equal(err, null);
                done();
            });
        });
    });

    it('should send and receive message when forth argument sendSingleMessageAndReceive is function', function (done) {
      var server = net.createServer();
      server.listen();
      server.on('listening', function() {
          server.on('connection', function(socket) {
              var serverSocket = new JsonSocket(socket);
              serverSocket.on('message', function(message) {
                  assert.equal(message, 'test');
                  serverSocket.sendMessage('test');
              });
          });
        });
        JsonSocket.sendSingleMessageAndReceive(server.address().port, '127.0.0.1', 'test', function(err, message){
            assert.equal(message, 'test')
            done();
        });
    });

    it('should send and receive message when forth argument sendSingleMessageAndReceive is object with custom delimeter', function (done) {
      var server = net.createServer();
      server.listen();
      server.on('listening', function() {
          server.on('connection', function(socket) {
              var serverSocket = new JsonSocket(socket, { delimeter: "¡"});
              serverSocket.on('message', function(message) {
                  assert.equal(message, 'test');
                  serverSocket.sendMessage('test');
              });
          });
          JsonSocket.sendSingleMessageAndReceive(server.address().port, '127.0.0.1', 'test', { delimeter: "¡"}, function(err, message){
              assert.equal(message, 'test')
              done();
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
