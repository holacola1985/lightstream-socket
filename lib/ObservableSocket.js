/* jslint node: true */
"use strict";

var util = require('util');
var Subject = require('rx').Subject;

function observableSocket(Socket) {
  Socket = Socket || require('./Socket');

  function ObservableSocket(url, type, options) {
    Socket.call(this, url, type, options);

    this.subject = new Subject();
  }

  util.inherits(ObservableSocket, Socket);

  ObservableSocket.prototype.itemsAsObservable = function itemsAsObservable() {
    return this.subject;
  };

  ObservableSocket.prototype._reset = function _reset() {
    this.subject.dispose();
    this.subject = new Subject();
    Socket.prototype._reset.call(this);
  };

  ObservableSocket.prototype._emitItem = function _emitItem(item) {
    this.subject.onNext(item);
  };

  ObservableSocket.prototype._emitError = function _emitError(error) {
    this.subject.onError(error);
  };

  ObservableSocket.prototype._emitClosed = function _emitClosed() {
    this.subject.onCompleted();
  };

  return ObservableSocket;
}

module.exports = observableSocket;