var net = require('net');
const BUFFER_SIZE = 65536,
    FLUSH_TIMEOUT = 5;

var JsonSocket = function (socket) {
    this._socket = socket;
    this._waitMessageSize = 0;
    this._closed = false;
    this.dataTreated = 0;
    this._statistics = false;
    this._jsonBuffer = '';
    this._bufferCursor = 0;
    this._jsonBufferLength = 0;
    this._lastFlush = Date.now();
    socket.on('data', this._onData.bind(this));
    socket.on('connect', this._onConnect.bind(this));
    socket.on('close', this._onClose.bind(this));
    socket.on('err', this._onError.bind(this));
    var lastCheckSize = 0,
        that = this;
    setInterval(function () {
        if (that.isClosed()) {
            return;
        }
        if (Date.now() - that._lastFlush > 100 && lastCheckSize > 0 && that._bufferCursor >= lastCheckSize) {
            that.sendDeferred(undefined, true);
        }
        lastCheckSize = that._bufferCursor;
    }, 30);
};
module.exports = JsonSocket;

JsonSocket.sendSingleMessage = function (port, host, message, callback) {
    callback = callback || function () {
    };
    var socket = new JsonSocket(new net.Socket());
    socket.connect(port, host);
    socket.on('error', function (err) {
        callback(err);
    });
    socket.on('connect', function () {
        socket.sendEndMessage(message, callback);
    });
};

JsonSocket.sendSingleMessageAndReceive = function (port, host, message, callback) {
    callback = callback || function () {
    };
    var socket = new JsonSocket(new net.Socket());
    socket.connect(port, host);
    socket.on('error', function (err) {
        callback(err);
    });
    socket.on('connect', function () {
        socket.sendMessage(message, function (err) {
            if (err) {
                socket.end();
                return callback(err);
            }
            socket.on('message', function (message) {
                socket.end();
                if (message.success === false) {
                    return callback(new Error(message.message));
                }
                callback(null, message)
            });
        });
    });
};

JsonSocket.prototype = {
    _onConnect: function () {
        this._closed = false;
    },
    _onData: function (data) {
        if (this._statistics) {
            this.dataTreated += data.length;
        }
        try {
            this._handleData(data);
        } catch (e) {
            console.log(e);
            console.log(e.stack);
            process.exit();
            this.sendError(e);
        }
    },
    statistics: function () {
        this._statistics = true;
        var start = Date.now(),
            that = this;
        setInterval(function () {
            console.log((that.dataTreated / 1000000 / ((Date.now() - start) / 1000)) + ' MBytes/s');
        }, 2000);
    },
    _handleData: function (data) {
        if (this._messageSizeBuffer) {
            data = Buffer.concat([this._messageSizeBuffer, data]);
            this._messageSizeBuffer = null;
        }
        if (this._waitMessageSize === 0) {

            if (data.length < 4) {
                this._messageSizeBuffer = data;
                return;
            }

            var messageSize = data.readUInt32LE();

            if (data.length - 4 === messageSize) {
                if (this._jsonBuffer != '') {
                    this._jsonBufferLength++;
                    this._jsonBuffer += data.toString('utf8', 4, messageSize + 4) + ',';
                    this._handleMultipleMessages();
                    return;
                }
                this._handleMessage(data.slice(4));
            } else if (data.length - 4 > messageSize) {
                this._jsonBufferLength++;
                this._jsonBuffer += data.toString('utf8', 4, messageSize + 4) + ',';
                //if (this._jsonBufferLength > 20) {
                this._handleData(data.slice(messageSize + 4));
                //this._handleMultipleMessages();
                //}
                //this._handleMessage(data.slice(4, messageSize + 4));
            } else {
                if (this._jsonBuffer != '') {
                    this._handleMultipleMessages();
                }
                this._buffer = data.slice(4);
                this._waitMessageSize = messageSize;
                //console.log('wait for ', messageSize, data.toString(), this._buffer.length);
            }
        } else {
            this._buffer = Buffer.concat([this._buffer, data]);
            var bufferLength = this._buffer.length;
            if (bufferLength >= this._waitMessageSize) {
                this._handleMessage(this._buffer.slice(0, this._waitMessageSize));
                if (bufferLength == this._waitMessageSize) {
                    //console.log('ici aussi ?');
                    this._waitMessageSize = 0;
                    return;
                }
            }
            if (bufferLength > this._waitMessageSize) {
                //console.log('arrivé ?', bufferLength, this._waitMessageSize);
                var retainedSize = this._waitMessageSize;
                this._waitMessageSize = 0;
                this._handleData(this._buffer.slice(retainedSize));
            }
        }
    },
    _handleMultipleMessages: function () {
        var messages = JSON.parse('[' + this._jsonBuffer.substring(0, this._jsonBuffer.length - 1) + ']');
        this._jsonBuffer = '';
        this._jsonBufferLength = 0;
        messages.forEach(this._emitMessage.bind(this));
    },
    _emitMessage: function (message) {
        var that = this;
        process.nextTick(function () {
            that._socket.emit('message', message);
        });
    },
    _handleMessage: function (data) {
        var message;
        try {
            message = JSON.parse(data.toString());
        } catch (e) {
            var err = new Error('Could not parse JSON: ' + e.message + '\nRequest data: ' + data);
            err.code = 'E_INVALID_JSON';
            throw err;
        }
        message = message || {};
        this._emitMessage(message);
    },
    sendError: function (err) {
        this.sendMessage(this._formatError(err));
    },
    sendEndError: function (err) {
        this.sendEndMessage(this._formatError(err));
    },
    _formatError: function (err) {
        return {success: false, error: err.toString()};
    },
    sendMessage: function (message, callback) {
        if (this._closed) {
            if (callback) {
                callback(new Error('The socket is closed.'));
            }
            return;
        }
        this._socket.write(this._formatMessageData(message), callback);
    },
    sendDeferred: function (message, flush) {
        if (!this._messagesBuffer) {
            this._messagesBuffer = new Buffer(BUFFER_SIZE);
        }
        var writeToBuffer;
        if (message != void 0) {
            writeToBuffer = this._objectToBuffer(message, this._messagesBuffer, this._bufferCursor).size;
        } else {
            writeToBuffer = 0;
        }
        if (writeToBuffer === false || flush) {
            if (flush && writeToBuffer) {
                this._bufferCursor += writeToBuffer;
            }
            this._socket.write(this._messagesBuffer.slice(0, this._bufferCursor));
            this._lastFlush = Date.now();
            this._messagesBuffer = new Buffer(BUFFER_SIZE);
            this._bufferCursor = 0;
            if (writeToBuffer === false) {
                this.sendDeferred(message, flush);
            }
        } else {
            this._bufferCursor += writeToBuffer;
        }
    },
    sendEndMessage: function (message, callback) {
        var that = this;
        this.sendMessage(message, function (err) {
            that.end();
            if (callback) {
                if (err) return callback(err);
                callback();
            }
        });
    },
    _objectToBuffer: function (message, buffer, offset) {
        var messageData = JSON.stringify(message),
            messageSize = Buffer.byteLength(messageData, 'utf8');
        if (!buffer) {
            buffer = new Buffer(messageSize + 4);
        } else if (messageSize > BUFFER_SIZE) {
            throw new Error('Message to big to enter in the buffer')
        }
        if (!offset) {
            offset = 0;
        }
        if (messageSize + 4 + offset > buffer.length) {
            return {
                buffer: buffer,
                size: false
            };
        }
        buffer.writeUInt32LE(messageSize, offset);
        buffer.write(messageData, offset + 4, messageSize);
        return {
            buffer: buffer,
            size: messageSize + 4
        };
    },
    _formatMessageData: function (message) {
        return this._objectToBuffer(message).buffer;
    },

    _onClose: function () {
        this._closed = true;
    },
    _onError: function () {
        this._closed = true;
    },
    isClosed: function () {
        return this._closed;
    }

};

var delegates = [
    'connect',
    'on',
    'end'
];
delegates.forEach(function (method) {
    JsonSocket.prototype[method] = function () {
        this._socket[method].apply(this._socket, arguments);
        return this
    }
});