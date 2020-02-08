'use strict';

const bn128 = require('rustbn.js');

module.exports = function (data) {
  const results = {};
  const returnData = bn128.mul(data);

  // check ecmul success or failure by comparing the output length
  if (returnData.length !== 64) {
    results.returnValue = Buffer.alloc(0);
    results.exception = 0;
  } else {
    results.returnValue = returnData;
    results.exception = 1;
  }

  return results;
};
