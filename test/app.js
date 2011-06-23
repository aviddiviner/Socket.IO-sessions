// Config
var PORT = 3000;

// Dependencies
require.paths.unshift('/usr/local/lib/node_modules'); // NPM global packages

var connect = require('connect'),
    fs      = require('fs'),
    io      = require('socket.io'),
    sio     = require('..');

var inspect = require('eyes').inspector();

// Create the session store
var MemoryStore = require('connect/lib/middleware/session/memory');
mystore = new MemoryStore;

// Create the webserver
var app = connect.createServer(
    connect.cookieParser(),
    connect.session({ secret:'faceroll here', store:mystore }),
    function(req, res, next){
        var session = req.session;
        inspect(session);
        fs.readFile(__dirname + '/ping.html', function(err, data){
            if (err) throw err;
            res.end(data);
        });
    }
);

// Pretty console messages
console.red = function(msg){
    console.log("\033[31m" + msg + "\033[0m");
}
console.green = function(msg){
    console.log("\033[32m" + msg + "\033[0m");
}
console.yellow = function(msg){
    console.log("\033[33m" + msg + "\033[0m");
}

// Socket.IO
var load_session_per_message = true;

var socket = sio.enable({
  socket: io.listen(app),
  store:  mystore,
  parser: connect.cookieParser(),
  per_message: load_session_per_message
});

app.listen(PORT);

if (load_session_per_message) {
    socket.on('sconnection', function(client){
        console.yellow('Client connected.');
        client.on('smessage', function(message, session){
            session.pings = session.pings + 1 || 1;
            console.red('Message: ' + JSON.stringify(message));
            console.red('Session: ' + JSON.stringify(session));
        });
        client.on('disconnect', function(){
            console.yellow('Client disconnected.');
        });
    });
    socket.on('sinvalid', function(client){
        console.yellow('Session invalid, send the client some instructions to refresh.');
    });
} else {
    socket.on('sconnection', function(client, session){
        //console.log(client.request.socketIOTransport);
        session.conns = session.conns + 1 || 1;
        console.yellow('Client connected. Loaded session.');
        console.yellow('Session: ' + JSON.stringify(session));
        client.on('message', function(message){
            // session = client.emit('srefresh');
            session.pings = session.pings + 1 || 1;
            console.green('Message: ' + JSON.stringify(message));
        });
        client.on('smessage', function(message, session){
            session.pings = session.pings + 1 || 1;
            console.red('Message: ' + JSON.stringify(message));
            console.red('Session: ' + JSON.stringify(session));
        });
        client.on('disconnect', function(){
            console.yellow('Client disconnected. Saving session.');
        });
    });
    socket.on('sinvalid', function(client){
        console.yellow('Session invalid, send the client some instructions to refresh.');
    });
}
/*
// other junk

//io.Listener.prototype._onConnectionOld = io.Listener.prototype._onConnection;
//io.Listener.prototype._onConnection = function(transport, req, res, up, head){
//  req.socketIOTransport = transport;  // Take note of the transport type
//  this._onConnectionOld.call(this, transport, req, res, up, head);
//};

var buffer = [];

    client.ssend = function(msg){
        client.send({sig:'OK',msg:msg});
    }
    client.sbroadcast = function(msg){
        client.broadcast({sig:'BROADCAST',msg:msg});
    }

    // App stuff from here onwards
    client.on('smessage', function(session, message){
        var msg = { message: [client.sessionId, message] };
        buffer.push(msg);
        if (buffer.length > 15) buffer.shift();
        client.sbroadcast(msg);
        session.pings = session.pings + 1 || 1;
  //    session.remoteIP = session.remoteIP || 'unknown';
  //    client.sbroadcast('[' + session.remoteIP + ' | ' + client.sessionId + '] ' + JSON.stringify(message));
  //    client.ssend('[server] You have made ' + session.pings + ' pings');
    });
    client.on('connect', function(){
        client.send({ buffer: buffer });
        client.broadcast({ announcement: client.sessionId + ' connected' });
    });
    client.on('disconnect', function(){
        client.broadcast({ announcement: client.sessionId + ' disconnected' });
    });

    client.emit('sconnect');
*/

console.log('Listening on http://0.0.0.0:' + PORT);
