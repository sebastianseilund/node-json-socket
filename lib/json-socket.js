var net = require('net');
const BUFFER_SIZE = 65535,
    FLUSH_TIMEOUT = 5;

var JsonSocket = function (socket) {
    this._socket = socket;
    this._waitMessageSize = 0;
    this._closed = false;
    this.dataTreated = 0;
    this._statistics = false;
    socket.on('data', this._onData.bind(this));
    socket.on('close', this._onClose.bind(this));
    socket.on('err', this._onError.bind(this));
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
            console.log((that.dataTreated / (Date.now() - start) / 1000) + ' Bytes/s');
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
                this._handleMessage(data.slice(4));
            } else if (data.length - 4 > messageSize) {
                this._handleMessage(data.slice(4, messageSize + 4));
                this._handleData(data.slice(messageSize + 4));
            } else {
                this._buffer = data.slice(4);
                this._waitMessageSize = messageSize;
            }
        } else {
            this._buffer = Buffer.concat([this._buffer, data]);
            if (this._buffer.length >= this._waitMessageSize) {
                this._handleMessage(this._buffer.slice(0, this._waitMessageSize));
            }
            if (this._buffer.length > this._waitMessageSize) {
                var savedMessSize = this._waitMessageSize;
                this._waitMessageSize = 0;
                this._handleData(this._buffer.slice(savedMessSize));
            } else if (this._buffer.length === this._waitMessageSize) {
                this._waitMessageSize = 0;
            }
        }
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
        this._socket.emit('message', message);
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
    _formatMessageData: function (message) {
        var messageData = JSON.stringify(message),
            messageSize = Buffer.byteLength(messageData, 'utf8');

        var data = new Buffer(messageSize + 4);
        data.writeUInt32LE(messageSize, 0);
        data.write(messageData, 4, messageSize);
        return data;
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