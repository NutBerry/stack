'use strict';

const utils = require('ethereumjs-util');

module.exports = function (data) {
  const results = {};

  results.returnValue = utils.sha256(data);
  results.exception = 1;

  return results;
};
