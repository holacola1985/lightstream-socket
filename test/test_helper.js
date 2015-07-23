/* jslint node: true */
"use strict";

function assertAsync(assert, done) {
  try {
    assert();
    done();
  } catch (error) {
    done(error);
  }
}

module.exports = {
  assertAsync: assertAsync
};