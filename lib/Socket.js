/* jslint node: true */
"use strict";

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var ConnectionError = require('./ConnectionError');


function Socket(url, max_retries, retry_interval) {
  EventEmitter.call(this);

  this.url = url;
  this.max_retries = max_retries || Socket.INFINITE_RETRIES;
  this.retries_done = 0;
  this.retry_interval = retry_interval || 1000;
  this.is_opened = false;
  this.aborted = false;
}

util.inherits(Socket, EventEmitter);

Socket.INFINITE_RETRIES = 0;

Socket.prototype.connect = function connect() {
  this.aborted = false;
  this._connect();
};

Socket.prototype._connect = function _connect() {
  var self = this;
  this.socket = new WebSocket(this.url);
  this.socket.onopen = function () {
    console.log('socket connected');
    self.is_opened = true;
    self._reset();
    self.emit('opened');
  };
  this.socket.onerror = onError(this);
  this.socket.onclose = onClose(this);
};

function onError(socket) {
  return onClose(socket);
}

function onClose(socket) {
  return function (event) {
    socket._close();
    socket._reconnect();
  };
}

Socket.prototype._canRetry = function () {
  return !this.aborted && (this.max_retries === Socket.INFINITE_RETRIES || this.retries_done < this.max_retries);
};

Socket.prototype._reconnect = function _reconnect() {
  var self = this;
  if (this._canRetry()) {
    this.retries_done++;
    setTimeout(function () {
      self._connect();
    }, this.retry_interval);
  } else {
    this.emit('error', new ConnectionError(this.url, this.retries_done));
    this._close();
  }
};

Socket.prototype.isOpened = function isOpened() {
  return this.is_opened;
};

Socket.prototype.setBoundingBox = function setBoundingBox(bounding_box) {
  this.bounding_box = bounding_box;
  var self = this;
  this.socket.onmessage = function (event) {
    self.emit('new_points', JSON.parse(event.data));
  };
  sendBoundingBoxInitialized(this.bounding_box, this.socket);
};

Socket.prototype._reset = function _reset() {
  if (this.bounding_box) {
    this.setBoundingBox(this.bounding_box);
  }
};

function sendBoundingBoxInitialized(bounding_box, socket) {
  socket.send(JSON.stringify([
    'bounding_box_initialized',
    bounding_box
  ]));
}

Socket.prototype.close = function close() {
  this._close();
  this.emit('closed');
};

Socket.prototype._close = function _close() {
  this.socket.onclose = function () {};
  this.socket.onerror = function () {};
  this.socket.onmessage = function () {};
  if (this.socket.readyState === WebSocket.OPEN) { this.socket.close(); }
  this.is_opened = false;
};

Socket.prototype.abort = function abort() {
  this.aborted = true;
};

module.exports = Socket;