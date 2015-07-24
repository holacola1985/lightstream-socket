/* jslint node: true */
/* jslint expr: true */
/*global describe, it, before, beforeEach, after, afterEach */
"use strict";

var chai = require('chai');
var expect = chai.expect;

var BoundingBox = require('../lib/BoundingBox');
var BadFormatError = require('../lib/BadFormatError');

describe('Bounding Box behavior', function () {
  it('should be an array', function () {
    var bounding_box = new BoundingBox({lon_min:21.0, lon_max:88.0, lat_min:-53.0, lat_max:44.5});

    expect(function () {
      bounding_box.check();
    }).to.throw(BadFormatError)
      .and.have.property('message').which.match(/be an Array/g);
  });

  it('should be an array of 4 values', function () {
    var bounding_box = new BoundingBox([21.0, -53.0, 88.0]);

    expect(function () {
      bounding_box.check();
    }).to.throw(BadFormatError)
      .and.have.property('message').which.match(/contains 4 values/g);
  });

  it('all values should be numbers', function () {
    var bounding_box = new BoundingBox(['swlon', 'swlat', 'nelon', 'nelat']);

    expect(function () {
      bounding_box.check();
    }).to.throw(BadFormatError)
      .and.have.property('message')
      .which.match(/SWLon.*\n.*SWLat.*\n.*NELon.*\n.*NELat.*a valid float/g);
  });

  it('longitude should be less than 180', function () {
    var bounding_box = new BoundingBox([188.0, -53.0, 231.0, 44.5]);

    expect(function () {
      bounding_box.check();
    }).to.throw(BadFormatError)
      .and.have.property('message')
      .which.match(/SWLon(.*)at most 180(.*)\n(.*)NELon(.*)at most 180/g);
  });

  it('longitude should be greater than -180', function () {
    var bounding_box = new BoundingBox([-231.0, -53.0, -188.0, 44.5]);

    expect(function () {
      bounding_box.check();
    }).to.throw(BadFormatError)
      .and.have.property('message')
      .which.match(/SWLon(.*)at least -180(.*)\n(.*)NELon(.*)at least -180/g);
  });

  it('latitude should be less than 90', function () {
    var bounding_box = new BoundingBox([21.0, 95.0, 88.0, 105.0]);

    expect(function () {
      bounding_box.check();
    }).to.throw(BadFormatError)
      .and.have.property('message')
      .which.match(/SWLat(.*)at most 90(.*)\n(.*)NELat(.*)at most 90/g);
  });

  it('latitude should be greater than -90', function () {
    var bounding_box = new BoundingBox([21.0, -105.0, 88.0, -95.0]);

    expect(function () {
      bounding_box.check();
    }).to.throw(BadFormatError)
      .and.have.property('message')
      .which.match(/SWLat(.*)at least -90(.*)\n(.*)NELat(.*)at least -90/g);
  });

  it('North East latitude should be greater than South West latitude', function () {
    var bounding_box = new BoundingBox([21.0, 53.0, 88.0, 44.5]);

    expect(function () {
      bounding_box.check();
    }).to.throw(BadFormatError)
      .and.have.property('message')
      .which.match(/NELat.*must be greater than.*SWLat/g);
  });
});