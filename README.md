Socket.IO-sessions
==================

A simple library for [Node.js](https://github.com/joyent/node) that allows you to easily use your sessions from [Connect](http://github.com/senchalabs/Connect), [Express](http://github.com/visionmedia/express) and others with [Socket.IO](http://github.com/LearnBoost/Socket.IO-node).


## Installation
    npm install socket.io-sessions


## How To Use
This library provides two methods of linking your session data with Socket.IO's connections. You can either reload the session from the store per-connection or per-message.

### TL;DR Version
The basic idea is that on new Socket.IO connection, you auto-magically have a callback like `function(client, session)` instead of just `function(client)`, giving you access to your session store data.

#### Server
    var connect = require('connect'),
        io      = require('socket.io'),
        sio     = require('socket.io-sessions');

    var store   = new MemoryStore;  // or RedisStore, etc
    var app     = connect.createServer(...);  // With sessions
    var socket  = io.listen(app);

    var ssocket = sio.enable(socket, store);  // <-- The magic line

This adds a new event which you can listen for using `ssocket.on(...)`, namely `sconnection`. It looks something like this:

    ssocket.on('sconnection', function(client, session){
        // Play with the session, saved on disconnect
    });

#### Client
On the client side, you need to include the `.js` code (see *Client Javascript* below) and then change your declaration to the following:

    var sid = ...;  // App should pass this to your view
    var socket = new io.SessionSocket(sid);

This passes the Connect/Express session ID to the client code so that it can tell the server who you are. You'll need to find a way to get the `sid` property in your view, of course. On Express, this is done like so:

    // In your view (EJS):
    var socket = new io.SessionSocket('<%= connect_sid %>');

    // In your app:
    app.get('/', function(req,res){
        res.render('index.ejs', {
            locals: { 
                connect_sid: req.sessionID
            }
        }
    });

Messages are then sent from the client as usual with `socket.send(...)`. That's it! You're done. Feel free to read on if you'd like a more detailed explanation though.



## Server Configuration
Let's have a better look at some example usage. Assuming we have the following basic app, using Connect:

    var connect = require('connect'),
        io      = require('socket.io'),
        sio     = require('socket.io-sessions');

    // Create the session store
    var MemoryStore = require('connect/middleware/session/memory');
    mystore = new MemoryStore;

    // Create the webserver
    var app = connect.createServer(
        connect.cookieParser(),
        connect.session({ store: mystore }),
        function(req, res, next){
            res.end('Hello World!');
            // var session = req.session;
        }
    ).listen(3000);

    // Listen with Socket.IO
    var socket = io.listen(app);

To allow Socket.IO to access our sessions, we do the following:

    // Make Socket.IO session aware
    var ssocket = sio.enable(socket, mystore);

This adds new events that we can listen for using the `ssocket.on(...)` listener. Let's take a look at how we use these.

### Per-connection session handling
This method loads the session from the store at the start of the connection, and then writes it on disconnect. You do this by adding a listener for the `sconnection` event, as follows:

    var socket = sio.enable(io.listen(app), store);

    socket.on('sconnection', function(client, session){
        // Client connected, session loaded
        client.on('message', function(message){ ... });
        client.on('disconnect', function(){
            // Client disconnected, session saved after this event
        });
    });

It is worth noting that if your application crashes, then the post-disconnect callback will never be called. So any changes you made to the session while that connection was active would be lost.

### Per-message session handling
This method will reload the session each time a message is received and then write it back to the store after firing the `smessage` callback. You use this as follows:

    var socket = sio.enable(io.listen(app), store, {per_message:1});

    socket.on('sconnection', function(client){
        client.on('smessage', function(message, session){
            // Play with the session, it gets saved after this event
        });
        client.on('disconnect', function(){ ... });
    });

### Using a different session store (e.g. Redis)
This is as simple as swopping out the two lines in our server code above with:

    // Create the session store
    var RedisStore = require('connect-redis');
    mystore = new RedisStore;

### Using Express or some other framework
If you were using Express, then your app declaration would look something like the following:

    // Create the webserver
    var app = express.createServer();
    app.use(express.cookieParser());
    app.use(express.session({ store: mystore });
    app.get('/', function(req, res){
        res.send('Hello World!');
    });
    app.listen(3000);



## Client Configuration
The client is configured as follows:

    var sid = ...;  // App should pass this to your view
    var socket = new io.SessionSocket(sid);

Where the `sid` is the ID of the session in your store. This is retrieved by the server using a call to `store.get(sid, ...)`. The client is then used the same as normally.

### Client Javascript
The client-side Javascript is minimal. In fact, this is it in its entirety:

    io.SessionSocket = function(sid, host, options){
      io.Socket.apply(this, [host, options]);
      this._sessionId = sid;
      this.on('connect', function(){
        this.send({__sid:this._sessionId, connect:1});
      });
    }
    io.util.inherit(io.SessionSocket, io.Socket);

Feel free to put that in a `.js` file or on your page in some `<script>` tags.

### Example page
Let's take a look at an example HTML page:

    <script src="/js/jquery-1.6.1.js"></script>
    <script src="/socket.io/socket.io.js"></script>
    <script src="/path/to/client/js"></script>
    <script>
      var sid = ...;  // App should pass this to your view
      var socket = new io.SessionSocket(sid);
      socket.on('connect', function(){
        $('#msgbox').append('<b>Connect!</b>\n');
      });
      socket.on('message', function(message){
        $('#msgbox').append('Message: ' + JSON.stringify(message) + '\n');
      });
      socket.connect();
    </script>
    <pre id="msgbox"></pre>
    <input id="sendmsg" type="button" value="Ping!"
        onclick="socket.send({a:'ping'});" />



## Expired Session Handling

There is an extra event called `sinvalid` which is fired if the session isn't found in the session store or if there is an error retrieving it. This is handled as follows.

    ssocket.on('sinvalid', function(client){
        // Session invalid or not found in the store.
        // Send the client some instructions to refresh.
    });
