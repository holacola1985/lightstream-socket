/* jslint node: true */
"use strict";

var util = require('util');
var assertAsync = require('./test_helper').assertAsync;
require('mock-socket');
window.WebSocket = MockSocket;

//TODO: delete this method once hack used for mock-server is not needed anymore
function buildTestableSocket(Socket) {
  var TestableSocket = function (url, max_retries, retry_interval) {
    Socket.call(this, url, max_retries, retry_interval);
  };

  util.inherits(TestableSocket, Socket);

  TestableSocket.prototype._close = function _close() {
    // hack to avoid calls to previous onclose handler, because of the implementation in mock-socket,
    // which does not replace handler, but add it as a new observer.
    this.socket.service.list['clientOnclose'] = [];
    Socket.prototype._close.call(this);
  };
  return TestableSocket;
}

function setMockServer(url, items, spy) {
  var mock_server = new MockServer(url);
  mock_server.on('connection', function (server) {
    server.on('message', function (data) {
      var points = items;
      data = JSON.parse(data);
      spy(data);
      if (data[0] == 'bounding_box_changed') {
        points = items.slice(0, -1);
      }
      console.log('sending ' + points.length + ' points for : ' + data[0]);
      server.send(JSON.stringify(points));
    });
  });

  return mock_server;
}

function closeSocket(socket) {
  socket.removeAllListeners('new_points');
  socket.close();
}

function assertHistoryPoints(socket, assert, done, clear) {
  return function assertions(points) {
    clear();
    assertAsync(assert(points), done);
    closeSocket(socket);
  };
}

module.exports = {
  buildTestableSocket: buildTestableSocket,
  setMockServer: setMockServer,
  closeSocket: closeSocket,
  assertHistoryPoints: assertHistoryPoints
};