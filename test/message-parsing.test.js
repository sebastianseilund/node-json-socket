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

    it('should parse JSON strings', function (cb) {
        socket._handleData(socket._formatMessageData("Hello there"));
        process.nextTick(function () {
            assert.equal(messages.length, 1);
            assert.equal(messages[0], 'Hello there');
            cb();
        });
    });

    it('should parse JSON numbers', function (cb) {
        socket._handleData(socket._formatMessageData('12.34'));
        process.nextTick(function () {
            assert.equal(messages.length, 1);
            assert.equal(messages[0], 12.34);
            cb();
        });
    });

    it('should parse JSON bools', function (cb) {
        socket._handleData(socket._formatMessageData(true));
        process.nextTick(function () {
            assert.equal(messages.length, 1);
            assert.equal(messages[0], true);
            cb();
        });
    });

    it('should parse JSON objects', function (cb) {
        socket._handleData(socket._formatMessageData({"a": "yes", "b": 9}));
        process.nextTick(function () {
            assert.equal(messages.length, 1);
            assert.deepEqual(messages[0], {a: 'yes', b: 9});
            cb();
        });
    });

    it('should parse JSON arrays', function (cb) {
        socket._handleData(socket._formatMessageData(["yes", 9]));
        process.nextTick(function () {
            assert.equal(messages.length, 1);
            assert.deepEqual(messages[0], ['yes', 9]);
            cb();
        });
    });

    it('should parse multiple messages in one packet', function (cb) {
        socket._handleData(Buffer.concat([socket._formatMessageData("hey"), socket._formatMessageData(true)]));
        process.nextTick(function () {
            assert.equal(messages.length, 2);
            assert.equal(messages[0], 'hey');
            assert.equal(messages[1], true);
            cb();
        });
    });

    it('should parse chunked messages', function (cb) {
        var msgSize = Buffer.byteLength('"Hello there"');
        var b = new Buffer(4 + Buffer.byteLength('"Hell'));
        b.writeUInt32LE(msgSize);
        b.write('"Hell', 4);
        var c = new Buffer('o there"');

        socket._handleData(b);
        socket._handleData(c);
        process.nextTick(function () {
            assert.equal(messages.length, 1);
            assert.equal(messages[0], 'Hello there');
            cb();
        });
    });

    it('should parse chunked and multiple messages', function (cb) {
        var msgSize = Buffer.byteLength('"Hello there"');
        var b = new Buffer(4 + Buffer.byteLength('"Hell'));
        b.writeUInt32LE(msgSize);
        b.write('"Hell', 4);
        var c = new Buffer('o there"');

        //console.log('par', b.toString());
        socket._handleData(b);
        //console.log('par', Buffer.concat([c, socket._formatMessageData(true)]).toString());
        socket._handleData(Buffer.concat([c, socket._formatMessageData(true)]));
        process.nextTick(function () {
            assert.equal(messages.length, 2);
            assert.equal(messages[0], 'Hello there');
            assert.equal(messages[1], true);
            cb();
        });
    });

    it('should fail to parse invalid JSON', function (cb) {
        var msgSize = Buffer.byteLength('"Hel');
        var b = new Buffer(4 + msgSize);
        b.writeUInt32LE(msgSize);
        b.write('"Hel', 4);
        try {
            socket._handleData(b);
        } catch (err) {
            process.nextTick(function () {
                assert.equal(err.code, 'E_INVALID_JSON');
            });
        }
        process.nextTick(function () {
            assert.equal(messages.length, 0);
            cb();
        });
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