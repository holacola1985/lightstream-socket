/* jslint node: true */
/* jslint expr: true */
/*global describe, it, before, beforeEach, after, afterEach */
"use strict";

var chai = require('chai');
var should = chai.should();
var sinon = require('sinon');
var sinon_chai = require('sinon-chai');
chai.use(sinon_chai);
chai.use(require('chai-things'));

var assertAsync = require('./test_helper').assertAsync;
var buildTestableSocket = require('./socket_helper').buildTestableSocket;
var setMockServer = require('./socket_helper').setMockServer;
var closeSocket = require('./socket_helper').closeSocket;
var assertHistoryItems = require('./socket_helper').assertHistoryItems;

var ConnectionError = require('../lib/ConnectionError');
var Socket = buildTestableSocket(require('../lib/Socket'));

describe('Socket behavior', function () {
  var url = 'ws://localhost/socket';
  var mock_server, spy, type;
  var items = [{
    geojson: {coordinates: [3.97, 43.58]}
  }, {
    geojson: {coordinates: [4.02, 43.63]}
  }, {
    geojson: {coordinates: [3.88, 43.55]}
  }];

  beforeEach(function () {
    type = 'station';
    spy = sinon.spy();

    mock_server = setMockServer(url, items, spy);
    new MockServer(MockServer.unresolvableURL);
  });

  describe('Socket connect and reconnect', function () {

    it('should connect to websocket server', function (done) {
      var socket = new Socket(url, type);

      var timeout;
      socket.on('opened', function () {
        clearTimeout(timeout);
        function assert() {
          socket.isOpened().should.be.true;
        }

        assertAsync(assert, done);
        socket.close();
      });

      socket.connect();
      timeout = setTimeout(function () {
        socket.close();
        done(new Error('open event should have been called'));
      }, 10);
    });

    it('should try to reconnect when first attempt fails', function (done) {
      var options = {
        max_retries: 2,
        retry_interval: 200
      };
      var socket = new Socket(MockServer.unresolvableURL, type, options);

      var timeout;
      socket.on('error', function () {
        clearTimeout(timeout);
        function assert() {
          socket.isOpened().should.be.false;
        }

        assertAsync(assert, done);
      });

      socket.connect();
      timeout = setTimeout(function () {
        done(new Error('error event should have been called'));
      }, 500);
    });

    it('should try to reconnect if socket is closed by the server', function (done) {
      mock_server.on('connection', function () {
        setTimeout(function () {
          mock_server.close();
        }, 20);
      });

      var options = {
        max_retries: 2,
        retry_interval: 200
      };
      var socket = new Socket(url, type, options);

      var timeout;
      socket.on('error', function () {
        clearTimeout(timeout);
        function assert() {
          socket.isOpened().should.be.false;
        }
        assertAsync(assert, done);
      });

      socket.connect();
      timeout = setTimeout(function () {
        done(new Error('error event should have been called'));
      }, 550);
    });

    it('should try to reconnect infinitely when socket is closed by the server, unless abort has been called', function (done) {
      mock_server.on('connection', function () {
        setTimeout(function () {
          mock_server.close();
        }, 20);
      });

      var options = {
        max_retries: Socket.INFINITE_RETRIES,
        retry_interval: 80
      };
      var socket = new Socket(url, type, options);

      var timeout;
      socket.on('error', function (error) {
        clearTimeout(timeout);
        function assert() {
          socket.isOpened().should.be.false;
          error.should.be.an.instanceof(ConnectionError);
        }

        assertAsync(assert, done);
      });

      socket.connect();
      setTimeout(function () {
        socket.abort();
      }, 350);

      timeout = setTimeout(function () {
        done(new Error('error event should have been called, after aborting'));
      }, 500);
    });

    it('should not try to reconnect if socket is closed by the client', function (done) {
      var socket = new Socket(url, type);

      var timeout;
      socket.on('closed', function () {
        clearTimeout(timeout);
        function assert() {
          socket.isOpened().should.be.false;
        }
        assertAsync(assert, done);
      });
      socket.on('opened', function () {
        socket.close();
      });

      socket.connect();
      timeout = setTimeout(function () {
        done(new Error('closed event should have been called'));
      }, 50);
    });
  });

  function test_socket_initialization(initialize_socket, event, bounding_box, done) {
    var socket = new Socket(url, type);
    socket.on('opened', function () {
      initialize_socket(socket);
    });

    var timeout;
    function clear() { clearTimeout(timeout); }

    function assert(items) {
      return function () {
        spy.should.have.been.calledWithMatch({
          event: event,
          bounding_box: bounding_box,
          type: 'station'});
        items.should.have.length(3);
      }
    }

    socket.on('new_items', assertHistoryItems(socket, assert, done, clear));

    socket.connect();
    timeout = setTimeout(function () {
      closeSocket(socket);
      done(new Error('new_items event should have been called for ' + event + ' event'));
    }, 100);
  }

  function test_socket_reconnection(initialize_socket, done) {
    var options = {
      max_retries: 2,
      retry_interval: 200
    };
    var socket = new Socket(url, type, options);

    var timeout;
    function clear() { clearTimeout(timeout); }

    socket.on('opened', function () {
      socket.removeAllListeners('opened');
      initialize_socket(socket);

      socket.on('opened', function () {
        function assert(items) {
          return function () {
            items.should.have.length(3);
          }
        }

        socket.on('new_items', assertHistoryItems(socket, assert, done, clear));
      });

      mock_server.close();
    });

    socket.connect();
    timeout = setTimeout(function () {
      closeSocket(socket);
      done(new Error('new_items event should have been called after reconnect'));
    }, 500);
  }

  describe('Listen socket', function () {
    var initialize_socket = function (socket) {
      socket.listen();
    };

    it('should listen to new items', function (done) {
      var bounding_box; // should be undefined

      test_socket_initialization(initialize_socket, "ready", bounding_box, done);
    });

    it('should listen again if socket is closed by the server', function (done) {
      test_socket_reconnection(initialize_socket, done);
    });
  });

  describe('Set Bounding Box', function () {
    var bounding_box = [3.78, 43.55, 4.04, 43.65];
    var initialize_socket = function (socket) {
      socket.initializeBoundingBox(bounding_box);
    };

    it('should set a bounding box, then load history items and subscribe to new items', function (done) {
      test_socket_initialization(initialize_socket, "bounding_box_initialized", bounding_box, done);
    });

    it('should re set the bounding box if socket is closed by the server', function (done) {
      test_socket_reconnection(initialize_socket, done);
    });
  });
});
