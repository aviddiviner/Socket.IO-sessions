io.connectWithSession = function(){
  var socket = io.connect.apply(io, arguments);
  socket.on('connect', function(){
    this.emit('connect_with_session', {__sid:CONNECT_SID});
  });
  return socket;
};
