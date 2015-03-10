var net = require('net'),
    JsonSocket = require('../lib/json-socket');

// Let' use unix socket
var socketName = '/tmp/socket.sock';
var server = net.createServer();
server.listen(socketName);
server.on('connection', function(socket) {
    socket = new JsonSocket(socket);
    var n;
    var isRunning = false;
    var streatTimeout;
    socket.on('message', function(message) {
        if (message.command == 'start') {
            if (!isRunning) {
                n = message.beginAt;
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

var socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
socket.connect(socketName);
socket.on('connect', function() { 
		
    //Don't send until we're connected
    socket.sendMessage({command: 'start', beginAt: 10});
    socket.on('message', function(square) {
        console.log(square);
        if (square > 200) {
            socket.sendMessage({command: 'stop'});
        }
    });
});

process.on('SIGINT', function() {
    console.log('Got SIGINT, terminating');
    
    // Try to end the connection
    socket.end();

    // Try to close, it should close once all existing connection ended
    server.close(function() {
        process.exit()
    });
});
