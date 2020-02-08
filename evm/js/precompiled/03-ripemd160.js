'use strict';

const utils = require('ethereumjs-util');

module.exports = function (data) {
  const results = {};

  results.returnValue = utils.ripemd160(data, true);
  results.exception = 1;

  return results;
};
