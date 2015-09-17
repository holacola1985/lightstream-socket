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
var assertAsync = require('./test_helper').assertAsync;

var Socket = buildTestableSocket(require('../lib/MapboxSocket'));

require('mapbox.js');
L.mapbox.accessToken = 'pk.eyJ1IjoiZnJhbmNrZXJuZXdlaW4iLCJhIjoiYXJLM0dISSJ9.mod0ppb2kjzuMy8j1pl0Bw';
L.mapbox.config.FORCE_HTTPS = true;
L.mapbox.config.HTTPS_URL = 'https://api.tiles.mapbox.com/v4';

describe('MapboxSocket behavior', function () {
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

    var map_container = '<div id="map" style="height:300px; width:300px;"></div>';
    document.body.insertAdjacentHTML(
      'afterbegin',
      map_container);
  });

  it('should attach a Leaflet map to socket, then load history items and subscribe to new items', function (done) {
    var socket = new Socket(url, type);
    var map = L.mapbox.map('map', 'mapbox.pirates')
      .setView([43.6, 3.91], 11);
    var expected_bounding_box = [3.8067626953124996, 43.52515287643569, 4.01275634765625, 43.67432820783561];

    socket.on('opened', function () {
      socket.attachMap(map);
    });

    var new_items_spy = sinon.spy();
    socket.on('new_items', new_items_spy);

    function assert() {
      spy.should.have.been.calledWith({
        event:"bounding_box_initialized",
        bounding_box: expected_bounding_box,
        type: type});
      new_items_spy.should.have.been.called;
      new_items_spy.callCount.should.equal(3);
      closeSocket(socket);
    }

    socket.connect();
    setTimeout(function () {
      assertAsync(assert, done);
    }, 30);
  });

  it('should reload all history items when map moves corresponding to the new bounds', function (done) {
    var socket = new Socket(url, type);
    var map = L.mapbox.map('map', 'mapbox.pirates')
      .setView([43.6, 3.91], 13);
    var expected_bounding_box = [4.024257659912109, 43.65135445960513, 4.075756072998046, 43.68860475533579];

    var new_items_spy = sinon.spy();

    socket.on('new_items', new_items_spy);

    socket.on('opened', function () {
      socket.attachMap(map);
      map.setView([43.67, 4.05], 13);
    });

    socket.connect();

    function assert() {
      spy.should.have.been.calledWith({
        event:"bounding_box_changed",
        bounding_box: expected_bounding_box,
        type: type});
      new_items_spy.should.have.been.called;
      new_items_spy.callCount.should.equal(3 + 2); // 3 for bounding_box_initialized and 2 for bounding_box_changed
      closeSocket(socket);
    }

    setTimeout(function () {
      assertAsync(assert, done);
    }, 150);
  });

  it('should re attach the map if socket is closed by the server', function (done) {
    var options = {
      max_retries: 2,
      retry_interval: 100
    };
    var socket = new Socket(url, type, options);
    var map = L.mapbox.map('map', 'mapbox.pirates')
      .setView([43.6, 3.91], 13);

    var new_items_spy = sinon.spy();

    socket.on('opened', function closeServer() {
      socket.removeAllListeners('opened');
      socket.attachMap(map);
      socket.on('opened', function () {
        socket.on('new_items', new_items_spy);
      });

      mock_server.close();
    });

    socket.connect();

    function assert() {
      new_items_spy.should.have.been.called;
      new_items_spy.callCount.should.equal(3);
      socket.isOpened().should.be.true;
      closeSocket(socket);
    }

    setTimeout(function () {
      assertAsync(assert, done);
    }, 250);
  });

  afterEach(function () {
    document.body.removeChild(document.getElementById('map'));
  });
});