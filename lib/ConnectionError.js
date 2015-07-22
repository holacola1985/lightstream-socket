/* jslint node: true */
"use strict";

var util = require('util');

function ConnectionError(url, retries) {
  Error.call(this);

  this.name = 'ConnectionError';
  var message = ['connection to url', url, 'was impossible after', retries, 'retries.'];
  this.message = message.join(' ');
}

util.inherits(ConnectionError, Error);

module.exports = ConnectionError;