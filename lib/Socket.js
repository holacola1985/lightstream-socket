/* jslint node: true */
"use strict";

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var ConnectionError = require('./ConnectionError');
var BoundingBox = require('./BoundingBox');


function Socket(url, type, max_retries, retry_interval) {
  EventEmitter.call(this);

  this.url = url;
  this.type = type;
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

Socket.prototype.listen = function listen() {
  this._listenSocket();
  this._sendMessage('ready');
};

Socket.prototype._listenSocket = function _listenSocket() {
  var self = this;
  this.socket.onmessage = function (event) {
    self.emit('new_items', JSON.parse(event.data));
  };
  this.listening = true;
};

Socket.prototype.initializeBoundingBox = function initializeBoundingBox(bounding_box) {
  this._setBoundingBox(bounding_box);
  this._listenSocket();
  this._sendMessage('bounding_box_initialized');
};

Socket.prototype._setBoundingBox = function _setBoundingBox(bounding_box) {
  new BoundingBox(bounding_box).check();
  this.bounding_box = bounding_box;
};

Socket.prototype._reset = function _reset() {
  if (!this.listening) {
    return;
  }

  if (this.bounding_box) {
    this.initializeBoundingBox(this.bounding_box);
  }
  this.listen();
};

Socket.prototype._sendMessage = function _sendMessage(event) {
  this.socket.send(JSON.stringify({
    event: event,
    bounding_box: this.bounding_box,
    type: this.type
  }));
};

Socket.prototype.close = function close() {
  this._close();
  this.listening = false;
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