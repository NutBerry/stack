'use strict';

const utils = require('ethereumjs-util');
const BN = utils.BN;

module.exports = function (data) {
  const results = {};

  results.returnValue = data;
  results.exception = 1;

  return results;
};