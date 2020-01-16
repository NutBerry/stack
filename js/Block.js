'use strict';

const ethers = require('ethers');

const Inventory = require('./Inventory.js');
const NutBerryRuntime = require('./NutBerryRuntime.js');
const Utils = require('./Utils.js');

module.exports = class Block {
  constructor (prevBlock) {
    // previous block - if applicable
    this.prevBlock = prevBlock;
    // the blockHash - only available if this block was submitted to the Bridge.
    this.hash = '';
    // the solution for this Block - only used as cache
    this.solution = null;
    // the blockNumber
    this.number = prevBlock ? prevBlock.number + 1 : 1;
    // the token inventory
    this.inventory = prevBlock ? prevBlock.inventory.clone() : new Inventory();
    // address > nonce mapping
    this.nonces = {};
    // txHash > tx mapping
    this.transactions = {};
    // ordered list of transaction hashes in this Block
    this.transactionHashes = [];

    if (prevBlock) {
      // copy nonces since `prevBlock`
      this.nonces = Object.assign({}, prevBlock.nonces);
    }
  }

  addDeposit (obj) {
    this.inventory.addToken(obj);
  }

  log (...args) {
    console.log(`Block(${this.number})`, ...args);
  }

  async refactor (prevBlock, bridge) {
    this.hash = null;
    this.solution = null;

    this.prevBlock = prevBlock;
    this.inventory = prevBlock.inventory.clone();
    this.number = prevBlock.number + 1;

    this.log(`Refactor:Started ${this.transactionHashes.length} transactions`);

    this.nonces = Object.assign({}, prevBlock.nonces);

    const hashes = this.transactionHashes;
    const txs = this.transactions;
    this.transactions = {};
    this.transactionHashes = [];

    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i];
      const tx = txs[hash];

      if (this.prevBlock.transactions[hash]) {
        this.log('dropping', hash);
        continue;
      }

      this.log('Refactor:Adding tx');
      await this.addTransaction(tx);
    }
    this.log(`Refactor:Complete ${this.transactionHashes.length} transactions left`);
  }

  async addTransaction (tx) {
    const expectedNonce = this.nonces[tx.from] | 0;

    if (this.validateTransaction(tx, expectedNonce)) {
      const { errno, returnValue, logs } = await this.executeTx(tx);

      this.log(`${tx.from}:${tx.nonce}:${tx.hash}`);

      // TODO
      // save transaction receipts for reverted transactions
      if (errno !== 0) {
        this.log('invalid tx', tx.hash);
        return false;
      }

      tx.logs = logs;
      // TODO: BigInt
      this.nonces[tx.from] = tx.nonce + 1;
      this.inventory.trackNonce(tx.from, tx.nonce + 1);
      this.transactions[tx.hash] = tx;
      this.transactionHashes.push(tx.hash);
      return true;
    }

    this.log('invalid or duplicate tx', tx.hash);

    return false;
  }

  validateTransaction (tx, expectedNonce) {
    if (tx.nonce !== expectedNonce) {
      this.log('wrong nonce', { nonce: tx.nonce, expectedNonce });
      return false;
    }

    if (tx.chainId !== 0) {
      this.log('invalid chainId');
      return false;
    }

    if (tx.gasPrice !== '0x00') {
      this.log('invalid gasPrice', tx);
      return false;
    }

    if (tx.gasLimit !== '0x00') {
      this.log('invalid gaslimit', tx);
      return false;
    }

    if (tx.value !== '0x00') {
      this.log('invalid value', tx);
      return false;
    }

    return true;
  }

  async dryExecuteTx (tx) {
    const { errno, returnValue, logs } = await this.executeTx(tx, true);

    if (errno !== 0) {
      return '0x';
    }

    return returnValue;
  }

  async executeTx (tx, dry) {
    const customEnvironment = dry ? this.inventory.clone() : this.inventory;

    // TODO
    const FUNC_SIG_BALANCE_OF = '0x70a08231';
    const FUNC_SIG_APPROVE = '0x095ea7b3';
    const FUNC_SIG_ALLOWANCE = '0xdd62ed3e';
    const FUNC_SIG_TRANSFER = '0xa9059cbb';
    const FUNC_SIG_TRANSFER_FROM = '0x23b872dd';
    const FUNC_SIG_OWNER_OF = '0x6352211e';
    const FUNC_SIG_GET_APPROVED = '0x081812fc';
    const FUNC_SIG_READ_DATA = '0x37ebbc03';
    const FUNC_SIG_WRITE_DATA = '0xa983d43f';
    const FUNC_SIG_BREED = '0x451da9f9';

    if (
      !tx.data.startsWith(FUNC_SIG_BALANCE_OF) &&
      !tx.data.startsWith(FUNC_SIG_APPROVE) &&
      !tx.data.startsWith(FUNC_SIG_ALLOWANCE) &&
      !tx.data.startsWith(FUNC_SIG_TRANSFER) &&
      !tx.data.startsWith(FUNC_SIG_TRANSFER_FROM) &&
      !tx.data.startsWith(FUNC_SIG_OWNER_OF) &&
      !tx.data.startsWith(FUNC_SIG_GET_APPROVED) &&
      !tx.data.startsWith(FUNC_SIG_READ_DATA) &&
      !tx.data.startsWith(FUNC_SIG_WRITE_DATA) &&
      !tx.data.startsWith(FUNC_SIG_BREED)
    ) {
      // eslint-disable-next-line no-undef
      let code = await provider.getCode(tx.to);
      // TODO: run the patched version of the contract?
      code = Utils.toUint8Array(code);
      const caller = Buffer.from(tx.to.replace('0x', ''), 'hex');
      // this is a contract
      const data = Utils.toUint8Array(tx.data);
      const address = Buffer.from(tx.to.replace('0x', ''), 'hex');
      const origin = Buffer.from(tx.from.replace('0x', ''), 'hex');
      // TODO: copy / snapshot inventory
      const runtime = new NutBerryRuntime();
      const state = await runtime.run({ address, origin, caller, code, data, customEnvironment });

      if (state.errno !== 0) {
        // TODO: revert state once we support arbitrary contracts
        this.log('STATE ERROR', state.errno, tx.hash, tx.from, tx.nonce);
      }

      return {
        errno: state.errno,
        returnValue: `0x${state.returnValue.toString('hex')}`,
        logs: state.logs,
      };
    }

    // not a contract
    const msgSender = tx.from.toLowerCase();
    // `self` is 0
    const to = '0x0000000000000000000000000000000000000000';
    const target = tx.to.toLowerCase();
    const data = tx.data.replace('0x', '');
    const res = customEnvironment.handleCall(msgSender, to, target, data) || '0x';
    const errno = res === '0x' ? 7 : 0;
    // TODO
    return {
      errno: errno,
      returnValue: res,
      logs: [],
    };

    return res;
  }

  getTransaction (txHash) {
    let block = this;

    while (block) {
      let tx = block.transactions[txHash];
      if (tx) {
        return tx;
      }
      block = block.prevBlock;
    }

    return null;
  }

  getBlockOfTransaction (txHash) {
    let block = this;

    while (block) {
      let tx = block.transactions[txHash];
      if (tx) {
        const txIndex = block.transactionHashes.indexOf(txHash);
        return { block, tx, txIndex };
      }
      block = block.prevBlock;
    }

    return {};
  }

  async submitBlock (bridge) {
    // TODO: check for MAX_PAYLOAD_SIZE
    const hashes = this.transactionHashes;
    const transactions = [];

    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i];
      let tx = this.transactions[hash];
      // rsv and so on
      tx = ethers.utils.parseTransaction(tx.raw);

      this.log('Preparing ' + tx.from + ':' + tx.nonce + ':' + tx.hash);

      const encoded = Utils.encodeTx(tx);
      transactions.push(encoded.replace('0x', ''));
    }

    const rawData = transactions.join('');
    const txData = {
      to: bridge.contract.address,
      data: '0x25ceb4b2' + rawData,
      value: bridge.bondAmount,
    };

    // post data
    let tx = await bridge.signer.sendTransaction(txData);
    tx = await tx.wait();

    Utils.dumpLogs(tx.logs, bridge.contract.interface);

    this.log('Block.submitBlock.postData', tx.gasUsed.toString());
    this.log(
      {
        total: hashes.length,
        submitted: transactions.length,
      }
    );

    // TODO: blockHash/number might not be the same if additional blocks are submitted in the meantime
    const blockHash = ethers.utils.keccak256('0x' + this.number.toString(16).padStart(64, '0') + rawData);

    return blockHash;
  }

  /// @dev Computes the solution for this Block.
  async computeSolution (bridge, doItWrong) {
    this.log('Block.computeSolution');

    if (this.solution) {
      this.log('solution already computed');
      return this.solution;
    }

    this.log(this.inventory.storageKeys);

    const storageKeys = this.inventory.storageKeys;
    const keys = Object.keys(storageKeys);
    let buf = Buffer.alloc(0);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const val = storageKeys[k];
      const n = Buffer.from(k.replace('0x', '') + val.replace('0x', ''), 'hex');
      buf = Buffer.concat([buf, n]);
    }

    if (doItWrong) {
      this.log('BadNodeMode!');

      buf = Buffer.alloc(64);
      buf[63] = 1;
    }

    // cache the result
    this.solution = {
      buffer: buf,
      hash: ethers.utils.solidityKeccak256(['bytes'], [buf]),
    };

    this.log('==================================================================================');
    this.log(this.solution);
    this.log('==================================================================================');

    return this.solution;
  }

  // @dev For testing
  async computeWrongSolution (bridge) {
    return this.computeSolution(bridge, true);
  }
};
