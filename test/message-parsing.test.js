var assert = require('assert'),
    net = require('net'),
    JsonSocket = require('../lib/json-socket');

describe('JsonSocket message parsing', function() {

    var socket = new JsonSocket(new net.Socket());
    var messages = [];
    socket.on('message', function(message) {
        messages.push(message);
    });

    beforeEach(function() {
        messages = [];
        socket._contentLength = null;
        socket._buffer = new Buffer(0);
    });

    it('should parse JSON strings', function() {
        socket._handleData(new Buffer('13#"Hello there"'));
        assert.equal(messages.length, 1);
        assert.equal(messages[0], 'Hello there');
        assert.equal(socket._buffer, '');
    });

    it('should parse JSON numbers', function() {
        socket._handleData(new Buffer('5#12.34'));
        assert.equal(messages.length, 1);
        assert.equal(messages[0], 12.34);
        assert.equal(socket._buffer, '');
    });

    it('should parse JSON bools', function() {
        socket._handleData(new Buffer('4#true'));
        assert.equal(messages.length, 1);
        assert.equal(messages[0], true);
        assert.equal(socket._buffer, '');
    });

    it('should parse JSON objects', function() {
        socket._handleData(new Buffer('17#{"a":"yes","b":9}'));
        assert.equal(messages.length, 1);
        assert.deepEqual(messages[0], {a: 'yes', b: 9});
        assert.equal(socket._buffer, '');
    });

    it('should parse JSON arrays', function() {
        socket._handleData(new Buffer('9#["yes",9]'));
        assert.equal(messages.length, 1);
        assert.deepEqual(messages[0], ['yes', 9]);
        assert.equal(socket._buffer, '');
    });

    it('should parse multiple messages in one packet', function() {
        socket._handleData(new Buffer('5#"hey"4#true'));
        assert.equal(messages.length, 2);
        assert.equal(messages[0], 'hey');
        assert.equal(messages[1], true);
        assert.equal(socket._buffer, '');
    });

    it('should parse chunked messages', function() {
        socket._handleData(new Buffer('13#"Hel'));
        socket._handleData(new Buffer('lo there"'));
        assert.equal(messages.length, 1);
        assert.equal(messages[0], 'Hello there');
        assert.equal(socket._buffer, '');
    });

    it('should parse chunked and multiple messages', function() {
        socket._handleData(new Buffer('13#"Hel'));
        socket._handleData(new Buffer('lo there"4#true'));
        assert.equal(messages.length, 2);
        assert.equal(messages[0], 'Hello there');
        assert.equal(messages[1], true);
        assert.equal(socket._buffer, '');
    });

    it('should fail to parse invalid JSON', function() {
        try {
            socket._handleData(new Buffer('4#"Hel'));
        } catch (err) {
            assert.equal(err.code, 'E_INVALID_JSON');
        }
        assert.equal(messages.length, 0);
        assert.equal(socket._buffer, '');
    });

    it('should not accept invalid content length', function() {
        try {
            socket._handleData(new Buffer('wtf#"Hello"'));
        } catch (err) {
            assert.equal(err.code, 'E_INVALID_CONTENT_LENGTH');
        }
        assert.equal(messages.length, 0);
        assert.equal(socket._buffer, '');
    });

});