/* jslint node: true */
"use strict";

var BadFormatError = require('./BadFormatError');
var CoordinateError = require('./BadFormatError').CoordinateError;

function Coordinate(point, coordinate, value) {
  this.point = point;
  this.coordinate = coordinate;
  this.value = value;

  this.toString = function toString() {
    return ['[', this.point, this.coordinate, '] ', this.value].join('')
  };
}

function BoundingBox(bounding_box) {
  this.original = bounding_box;
}

BoundingBox.prototype._checkArrayFormat = function () {
  if (!(this.original instanceof Array)) {
    throw new BadFormatError('it should be an Array');
  }
  if (this.original.length !== 4) {
    throw new BadFormatError('it should contains 4 values');
  }

  var points = ['SW', 'SW', 'NE', 'NE'];
  var coordinates = ['Lon', 'Lat', 'Lon', 'Lat'];
  this.bounding_box = this.original.map(function (value, index) {
    return new Coordinate(points[index], coordinates[index], value);
  });
};

BoundingBox.prototype._checkMinMax = function (errors) {
  var min_values = [-180.0, -90.0];
  var max_values = [180.0, 90.0];

  this.bounding_box.forEach(function (coordinate, index) {
    if (isNaN(coordinate.value)) {
      errors.push(new CoordinateError(coordinate, 'must be a valid float number'));
    }

    var min_value = min_values[index % 2];
    if (coordinate.value < min_value) {
      coordinate.value = min_value;
    }

    var max_value = max_values[index % 2];
    if (coordinate.value > max_value) {
      coordinate.value = max_value;
    }
  });
};

BoundingBox.prototype._southWestLatitude = function () {
  return this.bounding_box[1];
};

BoundingBox.prototype._northEastLatitude = function () {
  return this.bounding_box[3];
};

BoundingBox.prototype.check = function check() {
  this._checkArrayFormat();

  var errors = [];
  this._checkMinMax(errors);
  if (this._southWestLatitude().value > this._northEastLatitude().value) {
    errors.push(new CoordinateError(this._northEastLatitude(), 'must be greater than', this._southWestLatitude()));
  }

  if (errors.length) {
    throw new BadFormatError(errors);
  }

  return this.bounding_box.map(function (coordinate) {
    return coordinate.value;
  });
};

module.exports = BoundingBox;