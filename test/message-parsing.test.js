var assert = require('assert'),
    net = require('net'),
    JsonSocket = require('../lib/json-socket');

describe('JsonSocket message parsing', function () {

    var socket = new JsonSocket(new net.Socket());
    var messages = [];
    socket.on('message', function (message) {
        messages.push(message);
    });

    beforeEach(function () {
        messages = [];
    });

    it('should parse JSON strings', function () {
        socket._handleData(socket._formatMessageData("Hello there"));
        assert.equal(messages.length, 1);
        assert.equal(messages[0], 'Hello there');
    });

    it('should parse JSON numbers', function () {
        socket._handleData(socket._formatMessageData('12.34'));
        assert.equal(messages.length, 1);
        assert.equal(messages[0], 12.34);
    });

    it('should parse JSON bools', function () {
        socket._handleData(socket._formatMessageData(true));
        assert.equal(messages.length, 1);
        assert.equal(messages[0], true);
    });

    it('should parse JSON objects', function () {
        socket._handleData(socket._formatMessageData({"a": "yes", "b": 9}));
        assert.equal(messages.length, 1);
        assert.deepEqual(messages[0], {a: 'yes', b: 9});
    });

    it('should parse JSON arrays', function () {
        socket._handleData(socket._formatMessageData(["yes", 9]));
        assert.equal(messages.length, 1);
        assert.deepEqual(messages[0], ['yes', 9]);
    });

    it('should parse multiple messages in one packet', function () {
        socket._handleData(Buffer.concat([socket._formatMessageData("hey"), socket._formatMessageData(true)]));
        assert.equal(messages.length, 2);
        assert.equal(messages[0], 'hey');
        assert.equal(messages[1], true);
    });

    it('should parse chunked messages', function () {
        var msgSize = Buffer.byteLength('"Hello there"');
        var b = new Buffer(4 + Buffer.byteLength('"Hell'));
        b.writeUInt32LE(msgSize);
        b.write('"Hell', 4);
        var c = new Buffer('o there"');

        socket._handleData(b);
        socket._handleData(c);
        assert.equal(messages.length, 1);
        assert.equal(messages[0], 'Hello there');
    });

    it('should parse chunked and multiple messages', function () {
        var msgSize = Buffer.byteLength('"Hello there"');
        var b = new Buffer(4 + Buffer.byteLength('"Hell'));
        b.writeUInt32LE(msgSize);
        b.write('"Hell', 4);
        var c = new Buffer('o there"');

        //console.log('par', b.toString());
        socket._handleData(b);
        //console.log('par', Buffer.concat([c, socket._formatMessageData(true)]).toString());
        socket._handleData(Buffer.concat([c, socket._formatMessageData(true)]));
        assert.equal(messages.length, 2);
        assert.equal(messages[0], 'Hello there');
        assert.equal(messages[1], true);
    });

    it('should fail to parse invalid JSON', function () {
        var msgSize = Buffer.byteLength('"Hel');
        var b = new Buffer(4 + msgSize);
        b.writeUInt32LE(msgSize);
        b.write('"Hel', 4);
        try {
            socket._handleData(b);
        } catch (err) {
            assert.equal(err.code, 'E_INVALID_JSON');
        }
        assert.equal(messages.length, 0);
    });

    //it('should not accept invalid content length', function () {
    //    try {
    //        socket._handleData(socket._formatMessageData('wtf#"Hello"'));
    //    } catch (err) {
    //        assert.equal(err.code, 'E_INVALID_CONTENT_LENGTH');
    //    }
    //    assert.equal(messages.length, 0);
    //    assert.equal(socket._buffer, '');
    //});

});