'use strict';

const { HydratedRuntime, BN } = require('../evm/utils');

module.exports = class VerifierRuntime extends HydratedRuntime {
  async initRunState (obj) {
    const runState = await super.initRunState(obj);

    runState.storageReads = {};
    runState.storageCache = {};
    runState.customEnvironment = obj.customEnvironment;

    return runState;
  }

  async handleSLOAD (runState) {
    const storageKey = runState.stack.pop().toString(16).padStart(64, '0');

    let res = runState.storageCache[storageKey] || runState.storageReads[storageKey];
    if (!res) {
      // if this throws, `runState.errno` gonna be 0xff
      res = await runState.customEnvironment.provider
        .getStorageAt(runState.customEnvironment.address, '0x' + storageKey);
      res = res.replace('0x', '');

      runState.storageReads[storageKey] = res;
    }
    runState.stack.push(new BN(res, 'hex'));
  }

  async handleSSTORE (runState) {
    const storageKey = runState.stack.pop().toString(16).padStart(64, '0');
    const val = runState.stack.pop().toString(16).padStart(64, '0');
    runState.storageCache[storageKey] = val;
  }

  async handleEXTCODESIZE (runState) {
    const addr = `0x${runState.stack.pop().toString(16).padStart(40, '0')}`;

    const res = await runState.customEnvironment.provider.getCode(addr);
    const len = (res.length / 2) - 2;

    runState.stack.push(new BN(len));
  }

  async handleEXTCODECOPY (runState) {
    const addr = `0x${runState.stack.pop().toString(16).padStart(40, '0')}`;
    const mAddr = runState.stack.pop();
    const cAddr = runState.stack.pop();
    const len = runState.stack.pop();

    const res = await runState.customEnvironment.provider.getCode(addr);
    const buf = Buffer.from(res.replace('0x', ''), 'hex');

    this.memStore(runState, mAddr, buf, cAddr, len);
  }
};
