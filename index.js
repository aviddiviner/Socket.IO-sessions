var url = require('url'),
    fs  = require('fs');

// Client-side Javascript

var clientVersion = exports.version = '0.5.5';
var clientPath = 'socket.io-sessions.js';
var clientData = "\
io.SessionSocket = function(host, options){\
  io.Socket.apply(this, [host, options]);\
  this._sessionId = CONNECT_SID;\
  this.on('connect', function(){\
    this.send({__sid:this._sessionId, connect:1});\
  });\
};\
io.util.inherit(io.SessionSocket, io.Socket);\
";

/**
 * Serve up the custom client Javascript (session ID included).
 *
 * @param {Object} HTTP Request object
 * @param {Object} HTTP Response object
 * @param {String} session ID
 * @api private
 */
function serveClientFile(req, res, sid){
  var entitytag = sid + clientVersion;
  if (req.headers['if-none-match'] == entitytag){
    // ETag matches; 304 Not Modified
    res.writeHead(304);
    res.end();
  } else {
    var data = "var CONNECT_SID = '" + sid + "';\n" + clientData;
    var clientFile = {
      headers: {
        'Content-Length' : data.length,
        'Content-Type'   : 'text/javascript',
        'ETag'           : entitytag
      //'Cache-Control'  : 'no-cache',
      //'Pragma'         : 'no-cache',
      //'Expires'        : 'Sat, 01 Jan 2000 00:00:00 GMT'
      },
      content: data,
      encoding: 'utf8'
    };
    res.writeHead(200, clientFile.headers);
    res.end(clientFile.content, clientFile.encoding);
  }
  return true;
}

/**
 * Returns wrapper function for cookieParser() that returns the session ID from the HTTP Request.
 *
 * @param {Function} connect/express cookieParser callback
 * @api private
 */
function makeCookieCutter(parser){
  var dummy = function(){};
  return function(req){
    parser(req, null, dummy);
    return req.cookies['connect.sid'];
  }
}

/**
 * Enables session handling on the socket.io socket by adding the `sconnection` event.
 *
 * @param {Hash} Hash of arguments:
 *                 socket: socket.io Listener
 *                 store:  connect Session Store
 *                 parser: connect cookieParser
 *      (optional) cutter: callback that returns SID from HTTP Request object, used instead of parser
 *      (optional) per_message: if true, the server will reload sessions per message
 * @api public
 */
exports.enable = function(args){

  var socket = (args && args.socket) ? args.socket : null;
  var store  = (args && args.store)  ? args.store  : null;
  if (!socket) throw "Not a valid socket!";
  if (!store) throw "No session store provided!";

  if (args.parser && typeof(args.parser) == 'function'){
    var cookieCutter = makeCookieCutter(args.parser);
  } else if (args.cutter && typeof(args.cutter) == 'function') {
    var cookieCutter = args.cutter;
  }
  if (!cookieCutter) throw "No cookie handler provided!";

  var options = {
    per_message : (args && args.per_message) ? args.per_message : false
  }

  // Add a listener to the top of the server stack to serve up client JS
  var listeners = socket.server.listeners('request');
  socket.server.removeAllListeners('request');
  socket.server.addListener('request', function(req, res){
    // Catch requests to /socket.io path (or whichever path socket.io uses)
    var path = url.parse(req.url).pathname;
    if (path && path.indexOf('/' + socket.options.resource) === 0){
      var file = path.substr(2 + socket.options.resource.length);
      // Serve up the client script
      if (req.method == 'GET' && file == clientPath){
        var session_id = cookieCutter(req);
        if (serveClientFile(req, res, session_id)) return;
      }
    }
    // Call all the other listeners down the stack
    for (var i = 0, len = listeners.length; i < len; i++){
      listeners[i].call(this, req, res);
    }
  });

  // This doesn't seem to cause any kind of recursive explosion, so it's all good I guess. :)
  socket.on('connection', function(client){
    client.on('message', function(message){
      if (message.__sid && message.connect) {
        // Message-based session handling; read & write the session on each message.
        if (options.per_message) {
          client.on('message', function(msg){
            store.get(message.__sid, function(error, session){
              if (error || !session) {
                socket.emit('sinvalid', client);
              } else {
                client.emit('smessage', msg, session);
                store.set(message.__sid, session);
              }
            });
          });
          socket.emit('sconnection', client);
        }
        // Connection-based session handling; read & write the session once per connection.
        if (!options.per_message) {
          store.get(message.__sid, function(error, session){
            if (error || !session) {
              socket.emit('sinvalid', client);
            } else {
              socket.emit('sconnection', client, session);
              client.on('disconnect', function(){
                store.set(message.__sid, session);
              });
            }
          });
        }
      }
    });
  });
  return socket;

};
