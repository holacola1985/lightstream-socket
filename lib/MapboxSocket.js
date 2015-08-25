/* jslint node: true */
"use strict";

var util = require('util');
var Socket = require('./Socket');

function MapboxSocket(url, type, max_retries, retry_interval) {
  Socket.call(this, url, type, max_retries, retry_interval);
}

util.inherits(MapboxSocket, Socket);

MapboxSocket.prototype.attachMap = function attachMap(map) {
  this.map = map;
  this.initializeBoundingBox(boundingBox(this.map));
  this.map.on('moveend', this._sendBoundingBoxChanged());
};

function boundingBox(map) {
  var bounds = map.getBounds();
  return [
    bounds._southWest.lng,
    bounds._southWest.lat,
    bounds._northEast.lng,
    bounds._northEast.lat
  ];
}

MapboxSocket.prototype._sendBoundingBoxChanged = function _sendBoundingBoxChanged() {
  var self = this;
  return function () {
    self._setBoundingBox(boundingBox(self.map));
    self._sendEvent('bounding_box_changed');
  };
};

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