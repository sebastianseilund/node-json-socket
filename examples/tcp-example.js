var net = require('net'),
    JsonSocket = require('../lib/json-socket');

var port = 9838;
var server = net.createServer();
server.listen(port);
server.on('connection', function(socket) {
    socket = new JsonSocket(socket);
    var n;
    var isRunning = false;
    var streamInterval;
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
