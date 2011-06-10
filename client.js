io.SessionSocket = function(host, options){
  io.Socket.apply(this, [host, options]);
  this._sessionId = CONNECT_SID;
  this.on('connect', function(){
    this.send({__sid:this._sessionId, connect:1});
  });
};
io.util.inherit(io.SessionSocket, io.Socket);
