'use strict';

const ethers = require('ethers');

module.exports = class EthereumRuntimeAdapter {
  constructor (runtimeContract) {
    // explicit mark it as view, so we can just call the execute function
    // TODO: ethers.js should provide the option to explicitly call a function
    // https://github.com/ethers-io/ethers.js/issues/395

    // Need to copy (read-only)
    let abi = JSON.parse(JSON.stringify(runtimeContract.interface.abi));

    abi[0].constant = true;
    abi[0].stateMutability = 'view';

    this.runtimeContract = new ethers.Contract(
      runtimeContract.address,
      abi,
      runtimeContract.provider
    );
    // this is used to derive the gas usage (payable)
    this.payableRuntimeContract = runtimeContract;
  }

  async execute (
    { code, data, pc, stepCount, stack, mem },
    payable
  ) {
    const res = await (payable ? this.payableRuntimeContract.execute : this.runtimeContract.execute)(
      code || '0x',
      pc | 0,
      // errno
      0,
      stepCount | 0,
      data || '0x',
      stack || [],
      mem || [],
    );

    if (res.wait) {
      return res.wait();
    }

    return {
      pc: res[0],
      errno: res[1],
      hashValue: res[2],
      stack: res[3],
      mem: res[4],
      returnData: res[5],
    };
  }
};
