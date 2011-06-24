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
    connect.session({secret:'faceroll here', store:mystore}),
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
var load_session_per_message = false;

var socket = sio.enable({
  socket: io.listen(app),
  store:  mystore,
  parser: connect.cookieParser(),
  per_message: load_session_per_message
});

app.listen(PORT);

if (load_session_per_message) {

    // Session is saved after each message
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

    // Session is saved on disconnect
    socket.on('sconnection', function(client, session){
        session.conns = session.conns + 1 || 1;
        console.yellow('Client connected. Loaded session.');
        console.yellow('Session: ' + JSON.stringify(session));
        client.on('message', function(message){
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

console.log('Listening on http://0.0.0.0:' + PORT);
