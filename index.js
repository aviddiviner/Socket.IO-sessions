/**
 * Enables session handling on the socket.io socket by adding the `sconnection` event.
 *
 * @param {Object} socket.io Listener
 * @param {Object} connect Session Store
 * @api public
 */
exports.enable = function(socket, store, options){

    per_message = (options && options.per_message) ? options.per_message : false;
    socket.load_session_per_message = per_message; // If you need to check later

    // This doesn't seem to cause any kind of recursive explosion, so it's all good I guess. :)
    socket.on('connection', function(client){
        client.on('message', function(message){
            if (message.__sid && message.connect) {
                // Message-based session handling; read & write the session on each message.
                if (per_message) {
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
                if (!per_message) {
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

/**
 * Version
 */
exports.version = '0.4.1';
