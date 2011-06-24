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

    var mystore = new MemoryStore;        // or RedisStore, etc
    var app = connect.createServer(...);  // With sessions

    var socket = sio.enable({
      socket: io.listen(app),         // Socket.IO listener
      store:  mystore,                // Your session store
      parser: connect.cookieParser()  // Cookie parser
    });

This adds a new event which you can listen for using `socket.on(...)`, namely `sconnection`. It looks something like this:

    socket.on('sconnection', function(client, session){
        // Play with the session, saved on disconnect
    });

#### Client
On the client side, you simply need to include a link to the JS file and then connect using `io.connectWithSession()` instead of `io.connect()`.

    <script src="/socket.io/socket.io.js"></script>
    <script src="/socket.io/socket.io-sessions.js"></script>
    <script>
      var socket = io.connectWithSession();
      ...
    </script>

That's it! You're done. Everything else is as normal. Feel free to read on if you'd like a more detailed explanation though.



## Server Configuration
Let's have a better look at some example usage. Assuming we have the following basic app, using Connect:

    var connect = require('connect'),
        io      = require('socket.io'),
        sio     = require('socket.io-sessions');

    // Create the session store
    var MemoryStore = require('connect/lib/middleware/session/memory');
    mystore = new MemoryStore;

    // Create the webserver
    var app = connect.createServer(
        connect.cookieParser(),
        connect.session({secret:'faceroll here', store:mystore}),
        function(req, res, next){
            res.end('Hello World!');
            // var session = req.session;
        }
    );

    // Listen with Socket.IO
    var iolistener = io.listen(app);

    app.listen(3000); // Start the webserver

To allow Socket.IO to access our sessions, we insert the following:

    // Make Socket.IO session aware
    var socket = sio.enable({
      socket: iolistener,
      store:  mystore,
      parser: connect.cookieParser()
    });

This adds new events that we can listen for using the `socket.on(...)` listener. Let's take a look at how we use these.

### Per-connection session handling
This method loads the session from the store at the start of the connection, and then writes it on disconnect. You do this by adding a listener for the `sconnection` event, as follows:

    socket.on('sconnection', function(client, session){
        // Client connected, session loaded
        client.on('message', function(message){ ... });
        client.on('disconnect', function(){
            // Client disconnected, session saved after this callback
        });
    });

It is worth noting that if your application crashes, then the post-disconnect callback will never be called. So any changes you made to the session while that connection was active would be lost.

### Per-message session handling
This method will reload the session each time a message is received and then write it back to the store after firing the `smessage` callback. You use this by passing the `per_message:true` option, as follows:

    var socket = sio.enable({
      socket: io.listen(app),
      store:  mystore,
      parser: connect.cookieParser(),
      per_message: true   // <-- Add this option
    });

    socket.on('sconnection', function(client){
        client.on('smessage', function(message, session){
            // Play with the session, it gets saved after this callback
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

### Expired session handling

There is an extra event called `sinvalid` which is fired if the session isn't found in the session store or if there is an error retrieving it. This is handled as follows.

    socket.on('sinvalid', function(client){
        // Session invalid or not found in the store.
        // Send the client some instructions to refresh.
    });

### Cutting cookies
In each example above, we've included a `cookieParser()` callback. This callback is used so that when the browser requests the client Javascript file, it takes the session ID from its cookie and bundles this along with the client code.

If you aren't using Connect or Express however, then you may be handling sessions differently. In this case you need to pass a callback that will allow the server to get the session ID from the given HTTP Request object, as follows:

    var socket = sio.enable({
      socket: io.listen(app),
      store:  session_store,
      cutter: myCookieCutter  // Note: cutter, not parser
    });

Here are two examples of such callbacks:

    var connectCookieCutter = function(req){
      var cookie = connect.utils.parseCookie(req.headers['cookie']);
      return cookie['connect.sid'];
    };

    var expressCookieCutter = function(req){
      var parser = express.cookieParser();
      parser(req, null, function(){});
      return req.cookies['connect.sid'];
    };

The session ID returned from this callback will be the ID used to retrieve the session data from the store using a call to `store.get(sid, ...)`.



## Client Configuration
The client configuration is really straightforward. All that is required is that the client JS link is included and then your client code is as usual, except using `var socket = io.SessionSocket()`.

The default path to the client JS is `/socket.io/socket.io-sessions.js`. Note that if you change the default path of Socket.IO from `/socket.io`, using the `socket.options.resource` setting, then this will also change the base path of this client JS.

### Browser caching
It is possible that the browser might cache the Javascript file, which can cause problems if the session expires or the session ID becomes invalid, since this is served inline with the JS. In this case, just add a timestamp to the link. If you're using express, this is how you do it:

    // In your view (EJS):
    <script src="/socket.io/socket.io-sessions.js?<%= timestamp %>"></script>

    // In your app:
    app.get('/', function(req,res){
        res.render('index.ejs', {
            locals: { 
                timestamp: (new Date()).getTime()
            }
        }
    });

### Example page
Let's take a look at an example HTML page:

    <script src="/socket.io/socket.io.js"></script>
    <script src="/socket.io/socket.io-sessions.js"></script>
    <script>
      var logmsg = function(msg){
        document.getElementById('msgbox').innerHTML += msg + '\n'; 
      };
      var socket = io.connectWithSession();
      socket.on('connect', function(){
        logmsg('<b>Connect!</b>');
      });
      socket.on('message', function(message){
        logmsg('Message: ' + JSON.stringify(message));
      });
    </script>
    <input id="sendmsg" type="button" value="Ping!"
      onclick="socket.send('ping', function(){ logmsg('(msg sent)'); });" />
    <pre id="msgbox"></pre>

