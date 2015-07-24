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
var assertHistoryPoints = require('./socket_helper').assertHistoryPoints;

var ConnectionError = require('../lib/ConnectionError');
var Socket = buildTestableSocket(require('../lib/Socket'));

describe('Socket behavior', function () {
  var url = 'ws://localhost/socket';
  var mock_server, spy;
  var items = [{
    geojson: {coordinates: [3.97, 43.58]}
  }, {
    geojson: {coordinates: [4.02, 43.63]}
  }, {
    geojson: {coordinates: [3.88, 43.55]}
  }];

  beforeEach(function () {
    spy = sinon.spy();
    mock_server = setMockServer(url, items, spy);
    new MockServer(MockServer.unresolvableURL);
  });

  describe('Socket connect an reconnect', function () {

    it('should connect to websocket server', function (done) {
      var socket = new Socket(url);

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
      var retries = 2;
      var retry_interval = 200;
      var socket = new Socket(MockServer.unresolvableURL, retries, retry_interval);

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

      var retries = 2;
      var retry_interval = 200;
      var socket = new Socket(url, retries, retry_interval);

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

      var retries = Socket.INFINITE_RETRIES;
      var retry_interval = 80;
      var socket = new Socket(url, retries, retry_interval);

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
      var socket = new Socket(url);

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

  describe('Set Bounding Box', function () {
    var bounding_box = [3.78, 43.55, 4.04, 43.65];

    it('should set a bounding box, then load history points and subscribe to new points', function (done) {
      var socket = new Socket(url);

      socket.on('opened', function () {
        socket.setBoundingBox(bounding_box);
      });

      var timeout;
      function clear() { clearTimeout(timeout); }

      function assert(points) {
        return function () {
          spy.should.have.been.calledWith(["bounding_box_initialized", bounding_box]);
          points.should.have.length(3);
        }
      }

      socket.on('new_points', assertHistoryPoints(socket, assert, done, clear));

      socket.connect();
      timeout = setTimeout(function () {
        closeSocket(socket);
        done(new Error('new_points event should have been called for bounding box initialized'));
      }, 100);
    });

    it('should re set the bounding box if socket is closed by the server', function (done) {
      var retries = 2;
      var retry_interval = 200;
      var socket = new Socket(url, retries, retry_interval);

      var timeout;
      function clear() { clearTimeout(timeout); }

      socket.on('opened', function () {
        socket.removeAllListeners('opened');
        socket.setBoundingBox(bounding_box);

        socket.on('opened', function () {
          function assert(points) {
            return function () {
              points.should.have.length(3);
            }
          }

          socket.on('new_points', assertHistoryPoints(socket, assert, done, clear));
        });

        mock_server.close();
      });

      socket.connect();
      timeout = setTimeout(function () {
        closeSocket(socket);
        done(new Error('new_points event should have been called'));
      }, 500);
    });
  });
});
