var assert = require('assert'),
    JsonSocket = require('../lib/json-socket'),
    helpers = require('./helpers');

describe('JsonSocket chaining', function() {

    it('should return the instance when subscribing to event', function(callback) {
        helpers.createServerAndClient(function(err, server, clientSocket, serverSocket) {
            if (err) return callback(err);

            assert( clientSocket.on('message',function(){}) instanceof JsonSocket )

            assert( clientSocket.on('connect',function(){}) === clientSocket )
            assert( clientSocket.on('message',function(){}).on('end', function(){}) === clientSocket )

            helpers.closeServer(server, callback);
        });
    });
});