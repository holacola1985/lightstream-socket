/* jslint node: true */
/* jslint expr: true */
/*global describe, it, before, beforeEach, after, afterEach */
"use strict";

var chai = require('chai');
var should = chai.should();
var sinon = require('sinon');
var sinon_chai = require('sinon-chai');
chai.use(sinon_chai);

var buildTestableSocket = require('./socket_helper').buildTestableSocket;
var setMockServer = require('./socket_helper').setMockServer;
var closeSocket = require('./socket_helper').closeSocket;
var assertHistoryPoints = require('./socket_helper').assertHistoryPoints;

var Socket = buildTestableSocket(require('../lib/MapboxSocket'));

require('mapbox.js');
L.mapbox.accessToken = 'pk.eyJ1IjoiZnJhbmNrZXJuZXdlaW4iLCJhIjoiYXJLM0dISSJ9.mod0ppb2kjzuMy8j1pl0Bw';
L.mapbox.config.FORCE_HTTPS = true;
L.mapbox.config.HTTPS_URL = 'https://api.tiles.mapbox.com/v4';

describe('MapboxSocket behavior', function () {
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

    var map_container = '<div id="map" style="height:300px; width:300px;"></div>';
    document.body.insertAdjacentHTML(
      'afterbegin',
      map_container);
  });

  it('should attach a Leaflet map to socket, then load history points and subscribe to new points', function (done) {
    var socket = new Socket(url);
    var map = L.mapbox.map('map', 'mapbox.pirates')
      .setView([43.6, 3.91], 11);
    var expected_bounding_box = [3.8067626953124996, 43.52515287643569, 4.01275634765625, 43.67432820783561];

    socket.on('opened', function () {
      socket.attachMap(map);
    });

    var timeout;
    function clear() { clearTimeout(timeout); }
    function assert(points) {
      return function () {
        spy.should.have.been.calledWith(["bounding_box_initialized", expected_bounding_box]);
        points.should.have.length(3);
      }
    }
    socket.on('new_points', assertHistoryPoints(socket, assert, done, clear));

    socket.connect();
    timeout = setTimeout(function () {
      closeSocket(socket);
      done(new Error('new_points event should have been called for bounding box initialized'));
    }, 30);
  });

  it('should reload all history points when map moves corresponding to the new bounds', function (done) {
    var socket = new Socket(url);
    var map = L.mapbox.map('map', 'mapbox.pirates')
      .setView([43.6, 3.91], 13);
    var expected_bounding_box = [4.024257659912109, 43.65135445960513, 4.075756072998046, 43.68860475533579];

    var timeout;
    function clear() { clearTimeout(timeout); }
    var event_count = 1; // 1st occurrence : bounding_box_initialized, 2nd: bounding_box_changed
    socket.on('new_points', function (points) {
      if (event_count++ < 2) {
        return;
      }
      function assert(points) {
        return function () {
          spy.should.have.been.calledWith(["bounding_box_changed", expected_bounding_box]);
          points.should.have.length(2);
        }
      }
      assertHistoryPoints(socket, assert, done, clear)(points);
    });

    socket.on('opened', function () {
      socket.attachMap(map);
      map.setView([43.67, 4.05], 13);
    });

    socket.connect();
    timeout = setTimeout(function () {
      closeSocket(socket);
      done(new Error('new_points event should have been called for bounding box changed'));
    }, 500);
  });

  it('should re attach the map if socket is closed by the server', function (done) {
    var retries = 2;
    var retry_interval = 200;
    var socket = new Socket(url, retries, retry_interval);
    var map = L.mapbox.map('map', 'mapbox.pirates')
      .setView([43.6, 3.91], 13);

    var timeout;
    function clear() { clearTimeout(timeout); }

    socket.on('opened', function closeServer() {
      socket.removeAllListeners('opened');
      socket.attachMap(map);
      socket.on('opened', function () {
        function assert(points) {
          return function () {
            points.should.have.length(3);
            socket.isOpened().should.be.true;
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

  afterEach(function () {
    document.body.removeChild(document.getElementById('map'));
  });
});