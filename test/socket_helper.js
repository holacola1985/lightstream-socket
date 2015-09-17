/* jslint node: true */
"use strict";

var util = require('util');
var _ = require('lodash');
var assertAsync = require('./test_helper').assertAsync;
require('mock-socket');
window.WebSocket = MockSocket;

//TODO: delete this method once hack used for mock-server is not needed anymore
function buildTestableSocket(Socket) {
  var TestableSocket = function (url, type, max_retries, retry_interval) {
    Socket.call(this, url, type, max_retries, retry_interval);
  };

  util.inherits(TestableSocket, Socket);

  TestableSocket.prototype._listenSocket = function _listenSocket() {
    // hack to avoid calls to previous onmessage handler, because of the implementation in mock-socket,
    // which does not replace handler, but add it as a new observer.
    this.socket.service.list['clientOnMessage'] = [];
    Socket.prototype._listenSocket.call(this);
  };

  TestableSocket.prototype._close = function _close() {
    // hack to avoid calls to previous onclose handler, because of the implementation in mock-socket,
    // which does not replace handler, but add it as a new observer.
    this.socket.service.list['clientOnclose'] = [];
    Socket.prototype._close.call(this);
  };
  return TestableSocket;
}

function filterItems(items, data) {
  var items_to_send = items;
  if (data.event === 'bounding_box_changed') {
    items_to_send = items_to_send.slice(0, -1);
  }
  if (data.filter) {
    items_to_send = _.where(items_to_send, {data: data.filter});
  }
  console.log('mock server sending ' + items_to_send.length + ' items for : ' + data.event);
  return items_to_send;
}

function setMockServer(url, items, spy) {
  var mock_server = new MockServer(url);
  mock_server.on('connection', function (server) {
    server.on('message', function (data) {
      data = JSON.parse(data);
      spy(data);
      filterItems(items, data).forEach(function (item) {
        server.send(JSON.stringify(item));
      });
    });
  });

  return mock_server;
}

function closeSocket(socket) {
  socket.removeAllListeners('new_items');
  socket.close();
}

module.exports = {
  buildTestableSocket: buildTestableSocket,
  setMockServer: setMockServer,
  closeSocket: closeSocket
};