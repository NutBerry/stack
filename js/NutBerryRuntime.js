'use strict';

const { EVMRuntime, BN } = require('../evm/utils');

module.exports = class NutBerryRuntime extends EVMRuntime {
  async initRunState (obj) {
    const runState = await super.initRunState(obj);

    runState.customEnvironment = obj.customEnvironment;

    return runState;
  }

  async handleEXTCODESIZE (runState) {
    // this is replaced by JUMPDEST in the patcher
  }

  async interceptCall (runState, target, data) {
    const inventory = runState.customEnvironment;
    const msgSender = `0x${runState.caller.toString('hex')}`;
    const to = '0x' + runState.address.toString('hex');

    return inventory.handleCall(msgSender, to, target, data);
  }

  async handleCALL (runState) {
    // gasLimit
    runState.stack.pop();
    const starget = '0x' + runState.stack.pop().toString(16).padStart(40, '0');
    const value = runState.stack.pop();
    const inOffset = runState.stack.pop();
    const inSize = runState.stack.pop();
    const retOffset = runState.stack.pop();
    const retSize = runState.stack.pop();
    const data = this.memLoad(runState, inOffset, inSize).toString('hex');

    const retData = await this.interceptCall(runState, starget, data);

    if (typeof retData === 'string') {
      runState.returnValue = Buffer.from(retData.replace('0x', ''), 'hex');
      runState.stack.push(new BN(1));
    } else {
      runState.returnValue = Buffer.alloc(0);
      runState.stack.push(new BN(0));
    }

    this.memStore(runState, retOffset, runState.returnValue, new BN(0), retSize);
  }

  async handleSTATICCALL (runState) {
    // skip for precompiles
    const _target = runState.stack[runState.stack.length - 2];
    if (_target.gten(0) && _target.lten(8)) {
      return super.handleSTATICCALL(runState);
    }

    // gasLimit
    runState.stack.pop();
    const target = `0x${runState.stack.pop().toString(16).padStart(40, '0')}`;
    const inOffset = runState.stack.pop();
    const inSize = runState.stack.pop();
    const retOffset = runState.stack.pop();
    const retSize = runState.stack.pop();
    const data = this.memLoad(runState, inOffset, inSize).toString('hex');

    const retData = await this.interceptCall(runState, target, data);

    if (typeof retData === 'string') {
      runState.returnValue = Buffer.from(retData.replace('0x', ''), 'hex');
      runState.stack.push(new BN(1));
    } else {
      runState.returnValue = Buffer.alloc(0);
      runState.stack.push(new BN(0));
    }

    this.memStore(runState, retOffset, runState.returnValue, new BN(0), retSize);
  }
};
