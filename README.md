# JsonSocket [![Build Status](https://secure.travis-ci.org/sebastianseilund/node-json-socket.png?branch=master)](https://travis-ci.org/sebastianseilund/node-json-socket)

`JsonSocket` is a very easy way to send JSON over a socket using either TCP or UNIX sockets. `JsonSocket` uses a [decorator pattern](http://en.wikipedia.org/wiki/Decorator_pattern)
to expose extra methods and events on instances of [`net.Socket`](http://nodejs.org/api/net.html#net_class_net_socket).
These methods and events makes it straightforward to send bidirectional JSON messages of any kind and size.


## Installation

You can install `JsonSocket` using Node Package Manager (npm): 

```
npm install json-socket
```

Or add it to your `package.json` file, like this:

```json
{
    ...
    "dependencies": {
        "json-socket": "*"
    }
    ...
}
```

And then run:

```
npm install
```

## Usage

`JsonSocket` relies on Node.js' built-in [`net`](http://nodejs.org/api/net.html) package. Everytime you have an instance
of `net.Socket` you simply wrap in an instance of `JsonSocket`.

### Simple client/server example

Here is a simple example where a client can connect to the server and send two numbers (a and b) that the server multiplies
and sends back the result.

#### Server

```javascript
var net = require('net'),
    JsonSocket = require('json-socket');

var port = 9838;
var server = net.createServer();
server.listen(port);
server.on('connection', function(socket) { //This is a standard net.Socket
    socket = new JsonSocket(socket); //Now we've decorated the net.Socket to be a JsonSocket
    socket.on('message', function(message) {
        var result = message.a + message.b;
        socket.sendEndMessage({result: result});
    });
});
```

### Client

```javascript
var net = require('net'),
    JsonSocket = require('json-socket');

var port = 9838; //The same port that the server is listening on
var host = '127.0.0.1';
var socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
socket.connect(port, host);
socket.on('connect', function() { //Don't send until we're connected
    socket.sendMessage({a: 5, b: 7});
    socket.on('message', function(message) {
        console.log('The result is: '+message.result);
    });
});
```

---------------------------------------

### Streaming example

Here is an example of a server that can stream square numbers. A client can connect and send a `start` command which should
also include a `beginAt` value, i.e. which number should be squared first. Then the server streams a square every second,
until the client sends a `stop` command.

#### Server

```javascript
var net = require('net'),
    JsonSocket = require('json-socket');

var port = 9838;
var server = net.createServer();
server.listen(port);
server.on('connection', function(socket) {
    socket = new JsonSocket(socket);
    var n;
    var isRunning = false;
    var streatTimeout;
    socket.on('message', function(message) {
        if (message.command == 'start') {
            if (!isRunning) {
                n = message.beginAt || 1;
                isRunning = true;
                streamInterval = setInterval(function() {
                    socket.sendMessage(n * n);
                    n++;
                }, 1000);
            }
        } else if (message.command == 'stop') {
            if (isRunning) {
                isRunning = false;
                clearInterval(streamInterval);
            }
        }
    });
});
```

### Client

```javascript
var net = require('net'),
    JsonSocket = require('json-socket');

var port = 9838; //The same port that the server is listening on
var host = '127.0.0.1';
var socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
socket.connect(port, host);
socket.on('connect', function() { //Don't send until we're connected
    socket.sendMessage({command: 'start', beginAt: 10});
    socket.on('message', function(square) {
        console.log(square);
        if (square > 200) {
            socket.sendMessage({command: 'stop'});
        }
    });
});
```

Will output:

```
100
121
144
169
196
225
```

---------------------------------------

### Sending a single message

JsonSocket has two helper methods that are useful if you just need to send a single message and you don't need the socket
to stay open.

The second method is `JsonSocket.sendSingleMessage`. It sends a single message and closes the connection instantly.
Use this if you need to send a server a message, but you don't need any response.

```javascript
var JsonSocket = require('json-socket');

JsonSocket.sendSingleMessage(port, host, {type: 'ping'}, function(err) {
    if (err) {
        //Something went wrong
        throw err;
    }
    console.log('Pinged '+host+' on port '+port);
});
````

The second method is `JsonSocket.sendSingleMessageAndReceive`. It sends a single message, waits for a single response
message from the server and closes the connection right after.
Use this if you need to send a server a message, and get a response, but you don't need the connection to stay open.

```javascript
var JsonSocket = require('json-socket');

JsonSocket.sendSingleMessageAndReceive(port, host, {type: 'ping'}, function(err, message) {
    if (err) {
        //Something went wrong
        throw err;
    }
    console.log('Server said: '+message.type); //E.g. pong
});
````

## Message formats

The messages can be any Javascript object that can be converted to JSON:

- Strings
- Numbers
- Booleans
- Objects
- Arrays
- Anything!



## Extra methods exposed on JsonSocket instances

Since `JsonSocket` is a decorator of `net.Socket`, it supports all methods that `net.Socket` supports.

Besides that the following methods and events are also available on `JsonSocket` instances.

### JsonSocket.sendSingleMessage(port, host, message, callback)

Sends a single message anc close the connection instantly.

__Arguments__

- port - Port to send the message to.
- most - Host to send the message to.
- message - The message to send.
- callback(err) - Will be called when the message has been sent.

---------------------------------------

### JsonSocket.sendSingleMessageAndReceive(port, host, message, callback)

Sends a single message to `host`:`port`, waits for a response message, and closes the connection right after.
As soon as the response message is received the `callback` function is invoked (if given) with the response message
as the second argument.

__Arguments__

- port - Port to send the message to.
- most - Host to send the message to.
- message - The message to send.
- callback(err, message) - Will be called when the response message has been received. The response message is given as the second argument.

---------------------------------------

### socket.sendMessage(message, callback)

Sends a JSON a message over the socket.

__Arguments__

- message - The message to send.
- callback(err) - Will be called after the message has been sent.

---------------------------------------

### socket.sendEndMessage(message, callback)

Same as `socket.sendMessage`, except that the socket is closed right after the message has been sent using 
[`net.end()`](http://nodejs.org/api/net.html#net_socket_end_data_encoding).

No more messages can be sent from either the server or client through this socket.

---------------------------------------

### socket.sendError(err, callback)

Convenience method for sending an error as a message. 

__Arguments__

- err - An Error object that should be formatted as a message.
- callback(err) - Will be called after the message has been sent.

__Example__

```javascript
socket.sendError(new Error('Something went wrong!');
```

Will send a message of this JSON format:

```json
{
    "success": false,
    "message": "Something went wrong"
}
```

---------------------------------------

### socket.sendEndError(err, callback)

Same as `socket.sendError`, except that the socket is closed right after the message has been sent using 
[`net.end()`](http://nodejs.org/api/net.html#net_socket_end_data_encoding).

No more messages can be sent from either the server or client through this socket.

---------------------------------------

### socket.isClosed()

Returns true if either the server or the client has closed the connection. Returns false otherwise.

---------------------------------------

### Event: 'message'

- message - the message received from the other side.

Emitted when a complete message has been received.


## How the protocol works

The `JsonSocket` protocol works by `JSON.stringify`'ing the message and prefixing it with a content length and a content length delimiter (#).

Example:

```javascript
socket.sendMessage({
    type: "ping"
});
```

Will send a message that looks like this:

```
15#{"type":"ping"}
```

This mechanism ensures that messages that are chunked will be parsed correctly.


##Todo

- `socket.request()` method, and `request` event. Makes it easier to send multiple requests with callbacks.







