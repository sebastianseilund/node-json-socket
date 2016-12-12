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
        socket._buffer = '';
    });

    it('should parse JSON strings', function() {
        socket._handleData('13#"Hello there"');
        assert.equal(messages.length, 1);
        assert.equal(messages[0], 'Hello there');
        assert.equal(socket._buffer, '');
    });

    it('should parse JSON numbers', function() {
        socket._handleData('5#12.34');
        assert.equal(messages.length, 1);
        assert.equal(messages[0], 12.34);
        assert.equal(socket._buffer, '');
    });

    it('should parse JSON bools', function() {
        socket._handleData('4#true');
        assert.equal(messages.length, 1);
        assert.equal(messages[0], true);
        assert.equal(socket._buffer, '');
    });

    it('should parse JSON objects', function() {
        socket._handleData('17#{"a":"yes","b":9}');
        assert.equal(messages.length, 1);
        assert.deepEqual(messages[0], {a: 'yes', b: 9});
        assert.equal(socket._buffer, '');
    });

    it('should parse JSON arrays', function() {
        socket._handleData('9#["yes",9]');
        assert.equal(messages.length, 1);
        assert.deepEqual(messages[0], ['yes', 9]);
        assert.equal(socket._buffer, '');
    });

    it('should parse multiple messages in one packet', function() {
        socket._handleData('5#"hey"4#true');
        assert.equal(messages.length, 2);
        assert.equal(messages[0], 'hey');
        assert.equal(messages[1], true);
        assert.equal(socket._buffer, '');
    });

    it('should parse chunked messages', function() {
        socket._handleData('13#"Hel');
        socket._handleData('lo there"');
        assert.equal(messages.length, 1);
        assert.equal(messages[0], 'Hello there');
        assert.equal(socket._buffer, '');
    });

    it('should parse chunked and multiple messages', function() {
        socket._handleData('13#"Hel');
        socket._handleData('lo there"4#true');
        assert.equal(messages.length, 2);
        assert.equal(messages[0], 'Hello there');
        assert.equal(messages[1], true);
        assert.equal(socket._buffer, '');
    });

    it('should parse chunked messages with multi-byte characters', function() {
        // 0x33 0x23 0xd8 0x22 0xa9 0x22 = 3#"ة" (U+00629)
        socket._onData(new Buffer([0x33, 0x23, 0x22, 0xd8]));
        socket._onData(new Buffer([0xa9, 0x22]));
        assert.equal(messages.length, 1);
        assert.equal(messages[0], 'ة');
    });

    it('should fail to parse invalid JSON', function() {
        try {
            socket._handleData('4#"Hel');
        } catch (err) {
            assert.equal(err.code, 'E_INVALID_JSON');
        }
        assert.equal(messages.length, 0);
        assert.equal(socket._buffer, '');
    });

    it('should not accept invalid content length', function() {
        try {
            socket._handleData('wtf#"Hello"');
        } catch (err) {
            assert.equal(err.code, 'E_INVALID_CONTENT_LENGTH');
        }
        assert.equal(messages.length, 0);
        assert.equal(socket._buffer, '');
    });
    
});