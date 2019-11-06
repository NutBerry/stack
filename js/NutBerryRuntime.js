'use strict';

const { EVMRuntime, BN } = require('../evm/utils');

const FUNC_SIG_BALANCE_OF = '70a08231';
const FUNC_SIG_APPROVE = '095ea7b3';
const FUNC_SIG_ALLOWANCE = 'dd62ed3e';
const FUNC_SIG_TRANSFER = 'a9059cbb';
const FUNC_SIG_TRANSFER_FROM = '23b872dd';
const FUNC_SIG_OWNER_OF = '6352211e';
const FUNC_SIG_GET_APPROVED = '081812fc';
const FUNC_SIG_READ_DATA = '37ebbc03';
const FUNC_SIG_WRITE_DATA = 'a983d43f';
const FUNC_SIG_BREED = '451da9f9';

module.exports = class NutBerryRuntime extends EVMRuntime {
  async initRunState (obj) {
    const runState = await super.initRunState(obj);

    runState.customEnvironment = obj.customEnvironment;

    return runState;
  }

  async handleEXTCODESIZE (runState) {
    runState.stack.pop();
    runState.stack.push(new BN(1));
  }

  async interceptCall (runState, target, data) {
    const inventory = runState.customEnvironment;

    let offset = 0;
    const funcSig = data.substring(offset, offset += 8);
    const msgSender = `0x${runState.caller.toString('hex')}`;

    if (funcSig === FUNC_SIG_BALANCE_OF) {
      const owner = `0x${data.substring(offset += 24, offset += 40)}`;

      return inventory.balanceOf(target, owner);
    }

    if (funcSig === FUNC_SIG_ALLOWANCE) {
      const owner = '0x' + data.substring(offset += 24, offset += 40);
      const spender = '0x' + data.substring(offset += 24, offset += 40);

      return inventory.allowance(target, owner, spender);
    }

    if (funcSig === FUNC_SIG_APPROVE) {
      // TODO
      const spender = '0x' + data.substring(offset += 24, offset += 40);
      const value = '0x' + data.substring(offset, offset += 64);

      return inventory.setAllowance(target, msgSender, spender, value);
    }

    if (funcSig === FUNC_SIG_TRANSFER) {
      const to = '0x' + data.substring(offset += 24, offset += 40);
      const value = '0x' + data.substring(offset, offset += 64);

      return inventory.transfer(msgSender, target, to, value);
    }

    if (funcSig === FUNC_SIG_TRANSFER_FROM) {
      const from = '0x' + data.substring(offset += 24, offset += 40);
      const to = '0x' + data.substring(offset += 24, offset += 40);
      const tokenId = '0x' + data.substring(offset, offset += 64);

      return inventory.transferFrom(msgSender, target, from, to, tokenId);
    }

    if (this.testing) {
      if (funcSig === FUNC_SIG_OWNER_OF) {
        const tokenId = '0x' + data.substring(offset, offset += 64);

        return inventory.ownerOf(target, tokenId);
      }

      if (funcSig === FUNC_SIG_GET_APPROVED) {
        const tokenId = '0x' + data.substring(offset, offset += 64);

        return inventory.getApproved('0x' + runState.address.toString('hex'), target, tokenId);
      }

      if (funcSig === FUNC_SIG_READ_DATA) {
        const tokenId = '0x' + data.substring(offset, offset += 64);

        return inventory.readData(target, tokenId);
      }

      if (funcSig === FUNC_SIG_WRITE_DATA) {
        const tokenId = '0x' + data.substring(offset, offset += 64);
        const newTokenData = '0x' + data.substring(offset, offset += 64);

        return inventory.writeData(msgSender, target, tokenId, newTokenData);
      }

      if (funcSig === FUNC_SIG_BREED) {
        const tokenId = '0x' + data.substring(offset, offset += 64);
        const to = '0x' + data.substring(offset += 24, offset += 40);
        const newTokenData = '0x' + data.substring(offset, offset += 64);

        return inventory.breed(msgSender, target, tokenId, to, newTokenData);
      }
    }
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
