'use strict';

module.exports = function (data) {
  const results = {};

  results.returnValue = data;
  results.exception = 1;

  return results;
};
