var net = require('net');
const BUFFER_SIZE = 65535,
    FLUSH_TIMEOUT = 5;

var JsonSocket = function (socket) {
    this._socket = socket;
    this._contentLength = null;
    this._buffer = new Buffer(0);
    this._writeBuffer = new Buffer(BUFFER_SIZE);
    this._writeBufferOffset = 0;
    this._closed = false;
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
        try {
            this._handleData(data);
        } catch (e) {
            this.sendError(e);
        }
    },
    _handleData: function (data) {
        this._buffer = Buffer.concat([this._buffer, data], this._buffer.length + data.length);
        if (this._contentLength == null) {
            var i = this._buffer.indexOf('#');
            //Check if the buffer has a #, if not, the end of the buffer string might be in the middle of a content length string
            if (i !== -1) {
                var rawContentLength = this._buffer.toString('ascii', 0, i);
                this._contentLength = parseInt(rawContentLength);
                if (isNaN(this._contentLength)) {
                    this._contentLength = null;
                    this._buffer = new Buffer(0);
                    var err = new Error('Invalid content length supplied (' + rawContentLength + ') in: ' + this._buffer);
                    err.code = 'E_INVALID_CONTENT_LENGTH';
                    throw err;
                }
                this._buffer = this._buffer.slice(i + 1);
            }
        }
        if (this._contentLength != null) {
            if (this._buffer.length == this._contentLength) {
                this._handleMessage(this._buffer.toString('utf8'));
            } else if (this._buffer.length > this._contentLength) {
                var message = this._buffer.toString('utf8', 0, this._contentLength);
                var rest = this._buffer.slice(this._contentLength);
                this._handleMessage(message);
                this._onData(rest);
            }
        }
    },
    _handleMessage: function (data) {
        this._contentLength = null;
        this._buffer = new Buffer(0);
        var message;
        try {
            message = JSON.parse(data);
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

    _flushBuffer: function (callback) {
        this._socket.write(this._writeBuffer.slice(0, this._writeBufferOffset), 'utf-8', callback);
        this._writeBuffer = new Buffer(BUFFER_SIZE);
        this._writeBufferOffset = 0;
    },

    sendMessage: function (message, callback) {
        clearTimeout(this._flushTimer);
        if (this._closed) {
            if (callback) {
                callback(new Error('The socket is closed.'));
            }
            return;
        }
        var formattedMsg = this._formatMessageData(message);
        if (formattedMsg.length + this._writeBufferOffset > BUFFER_SIZE) {
            this._flushBuffer();
        }
        this._writeBuffer.write(formattedMsg, this._writeBufferOffset);
        this._writeBufferOffset += Buffer.byteLength(formattedMsg, 'utf8');
        if (callback) {
            callback();
        }
        var that = this;
        this._flushTimer = setTimeout(function () {
            that._flushBuffer();
        }, FLUSH_TIMEOUT);
    },
    sendEndMessage: function (message, callback) {
        var that = this;
        this.sendMessage(message);
        clearTimeout(this._flushTimer);
        this._flushBuffer(function (err) {
            that.end();
            if (callback) {
                if (err) return callback(err);
                callback();
            }
        });
    },
    _formatMessageData: function (message) {
        var messageData = JSON.stringify(message);
        var data = Buffer.byteLength(messageData) + '#' + messageData;
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