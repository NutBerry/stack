'use strict';

const { EVMRuntime, BN } = require('../evm/utils');

module.exports = class NutBerryRuntime extends EVMRuntime {
  async initRunState (obj) {
    const runState = await super.initRunState(obj);

    runState.customEnvironment = obj.customEnvironment;
    runState.logs = [];

    return runState;
  }

  async handleEXTCODESIZE (runState) {
    // this is replaced by JUMPDEST in the patcher
  }

  async handleLOG (runState) {
    const val = (runState.opCode - 0xa0) + 2;

    const args = runState.stack.splice(runState.stack.length - val);
    const offset = args.pop().toNumber();
    const len = args.pop().toNumber();

    let ll = len;
    if (ll > runState.memory.length) {
      ll = runState.memory.length;
    }

    let data = '0x';
    for (let i = 0; i < ll; i++) {
      data += runState.memory[offset + i].toString(16).padStart(2, '0');
    }
    data = data.padEnd((len * 2) + 2, '0');

    const topics = [];
    while (args.length) {
      topics.push('0x' + args.pop().toString(16).padStart(64, '0'));
    }

    // TODO: add `address`
    const obj = {
      topics,
      data,
    };
    runState.logs.push(obj);
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
