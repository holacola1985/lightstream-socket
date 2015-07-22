/* jslint node: true */
"use strict";

var util = require('util');
var Socket = require('./Socket');

function MapboxSocket(url, max_retries, retry_interval) {
  Socket.call(this, url, max_retries, retry_interval);
}

util.inherits(MapboxSocket, Socket);

MapboxSocket.prototype.attachMap = function attachMap(map) {
  this.map = map;
  this.setBoundingBox(boundingBox(this.map));
  this.map.on('moveend', sendBoundingBoxChanged(boundingBox(this.map), this.socket));
};

function boundingBox(map) {
  var bounds = map.getBounds();
  return {
    lat_min: bounds._southWest.lat,
    lat_max: bounds._northEast.lat,
    lon_min: bounds._southWest.lng,
    lon_max: bounds._northEast.lng
  }
}

function sendBoundingBoxChanged(bounding_box, socket) {
  return function () {
    socket.send(JSON.stringify([
      'bounding_box_changed',
      bounding_box
    ]));
  };
}

MapboxSocket.prototype._reset = function _reset() {
  if (this.map) {
    this.attachMap(this.map);
  }
};

MapboxSocket.prototype._close = function _close() {
  Socket.prototype._close.call(this);
  if (this.map) { this.map.off('moveend'); }
};

module.exports = MapboxSocket;