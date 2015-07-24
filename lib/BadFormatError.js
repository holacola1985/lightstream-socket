/* jslint node: true */
"use strict";

var util = require('util');

function BadFormatError(errors) {
  Error.call(this);

  this.name = 'BadFormatError';
  var message = errors;
  if (errors instanceof Array) {
    this.errors = errors;
    message = '\n - ' + this.errors.join('\n - ');
  }
  this.message = 'the provided bounding box is badly formatted, with the following error(s): ' + message;
}

util.inherits(BadFormatError, Error);

function CoordinateError(coordinate, message, compared_coordinate) {
  this.coordinate = coordinate;
  this.compared_coordinate = compared_coordinate;
  this.message = message;

  this.toString = function toString() {
    return [this.coordinate, this.message, this.compared_coordinate].join(' ');
  };
}

module.exports = BadFormatError;
module.exports.CoordinateError = CoordinateError;