/* jslint node: true */
/* jslint expr: true */
/*global describe, it, before, beforeEach, after, afterEach */
"use strict";

var chai = require('chai');
var should = chai.should();

var assertAsync = require('./test_helper').assertAsync;
var buildTestableSocket = require('./socket_helper').buildTestableSocket;
var setMockServer = require('./socket_helper').setMockServer;

var ObservableSocket = buildTestableSocket(require('../lib/ObservableSocket')());

describe('ObservableSocket behavior', function () {
  var url = 'ws://localhost/socket';
  var mock_server, type;
  var items = [{
    geojson: {coordinates: [3.97, 43.58]},
    data: { linked_item: 34 }
  }, {
    geojson: {coordinates: [4.02, 43.63]},
    data: { linked_item: 48 }
  }, {
    geojson: {coordinates: [3.88, 43.55]},
    data: { linked_item: 34 }
  }];

  beforeEach(function () {
    type = 'station';
    mock_server = setMockServer(url, items);
    new MockServer(MockServer.unresolvableURL);
  });

  it('should stream items through an observable', function (done) {
    var socket = new ObservableSocket(url, type);

    socket.on('opened', function () {
      socket
        .itemsAsObservable()
        .count()
        .subscribe(function (count) {
          function assert() {
            count.should.equal(3);
          }
          assertAsync(assert, done);
        }, done);

      socket.listen();
    });

    socket.connect();
    setTimeout(function () {
      socket.close();
    }, 50);
  });
});