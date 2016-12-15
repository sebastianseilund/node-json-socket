var assert = require('assert'),
    async = require('async'),
    JsonSocket = require('../lib/json-socket'),
    helpers = require('./helpers');

describe('JsonSocket shortcuts', function() {

    it('should send single message', function(done) {
        helpers.createServer(function(err, server) {
            if (err) return done(err);
            async.parallel([
                function(callback) {
                    server.on('connection', function(socket) {
                        var serverSocket = new JsonSocket(socket);
                        serverSocket.on('message', function(message) {
                            assert.deepEqual(message, {type: 'ping'});
                            assert.equal(serverSocket.isClosed(), false);
                            setTimeout(function() {
                                assert.equal(serverSocket.isClosed(), true);
                                callback();
                            }, 10);
                        });
                    });
                },
                function(callback) {
                    JsonSocket.sendSingleMessage(server.address().port, server.address().host, {type: 'ping'}, callback);
                }
            ], function(err) {
                if (err) return done(err);
                helpers.closeServer(server, done);
            });
        });
    });

    it('should send single message and receive', function(done) {
        helpers.createServer(function(err, server) {
            if (err) return done(err);
            async.parallel([
                function(callback) {
                    server.on('connection', function(socket) {
                        var serverSocket = new JsonSocket(socket);
                        serverSocket.on('message', function(message) {
                            assert.deepEqual(message, {type: 'ping'});
                            assert.equal(serverSocket.isClosed(), false);
                            setTimeout(function() {
                                assert.equal(serverSocket.isClosed(), false);
                                serverSocket.sendEndMessage({type: 'pong'}, callback);
                            }, 10);
                        });
                    });
                },
                function(callback) {
                    JsonSocket.sendSingleMessageAndReceive(server.address().port, server.address().host, {type: 'ping'}, function(err, message) {
                        if (err) return callback(err);
                        assert.deepEqual(message, {type: 'pong'});
                        callback();
                    });
                }
            ], function(err) {
                if (err) return done(err);
                helpers.closeServer(server, done);
            });
        });
    });

});