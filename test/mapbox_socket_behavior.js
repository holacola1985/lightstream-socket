/* jslint node: true */
/* jslint expr: true */
/*global describe, it, before, beforeEach, after, afterEach */
"use strict";

var chai = require('chai');
var should = chai.should();
var buildTestableSocket = require('./socket_helper').buildTestableSocket;
var setMockServer = require('./socket_helper').setMockServer;

var Socket = buildTestableSocket(require('../lib/MapboxSocket'));

require('mapbox.js');
L.mapbox.accessToken = 'pk.eyJ1IjoiZnJhbmNrZXJuZXdlaW4iLCJhIjoiYXJLM0dISSJ9.mod0ppb2kjzuMy8j1pl0Bw';
L.mapbox.config.FORCE_HTTPS = true;
L.mapbox.config.HTTPS_URL = 'https://api.tiles.mapbox.com/v4';

describe('MapboxSocket behavior', function () {
  var url = 'ws://localhost/socket';
  var mock_server;
  var items = [{
    geojson: {coordinates: [3.97, 43.58]}
  }, {
    geojson: {coordinates: [4.02, 43.63]}
  }, {
    geojson: {coordinates: [3.88, 43.55]}
  }];

  beforeEach(function () {
    mock_server = setMockServer(url, items);

    var map_container = '<div id="map" style="height:300px; width:300px;"></div>';
    document.body.insertAdjacentHTML(
      'afterbegin',
      map_container);
  });

  function closeSocket(socket, assertions) {
    socket.removeListener('new_points', assertions);
    socket.close();
  }

  it('should attach a Leaflet map to socket, then load history points and subscribe to new points', function (done) {
    var socket = new Socket(url);
    var map = L.mapbox.map('map', 'mapbox.pirates')
      .setView([43.6, 3.91], 13);

    socket.on('opened', function () {
      socket.attachMap(map);
    });

    var timeout;

    function assertions(points) {
      clearTimeout(timeout);
      points.should.have.length(3);
      closeSocket(socket, assertions);
      done();
    }

    socket.on('new_points', assertions);

    socket.connect();
    timeout = setTimeout(function () {
      closeSocket(socket, assertions);
      done(new Error('new_points event should have been called for bounding box initialized'));
    }, 30);
  });

  it('should reload all history points when map moves corresponding to the new bounds', function (done) {
    var socket = new Socket(url);
    var map = L.mapbox.map('map', 'mapbox.pirates')
      .setView([43.6, 3.91], 13);

    var timeout;
    var event_count = 1; // 1st occurrence : bounding_box_initialized, 2nd: bounding_box_changed
    function assertions(points) {
      if (event_count++ < 2) {
        return;
      }
      clearTimeout(timeout);
      points.should.have.length(2);
      closeSocket(socket, assertions);
      done();
    }

    socket.on('new_points', assertions);

    socket.on('opened', function () {
      socket.attachMap(map);
      map.setView([43.67, 4.05], 13);
    });

    socket.connect();
    timeout = setTimeout(function () {
      closeSocket(socket, assertions);
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
    function assertions(points) {
      clearTimeout(timeout);
      points.should.have.length(3);
      closeSocket(socket, assertions);
      done();
    }

    socket.on('opened', function closeServer() {
      socket.removeAllListeners('opened');
      socket.attachMap(map);
      socket.on('opened', function () {
        socket.isOpened().should.be.true;
        socket.on('new_points', assertions);
      });

      mock_server.close();
    });

    socket.connect();
    timeout = setTimeout(function () {
      closeSocket(socket, assertions);
      done(new Error('new_points event should have been called'));
    }, 500);
  });

  afterEach(function () {
    document.body.removeChild(document.getElementById('map'));
  });
});