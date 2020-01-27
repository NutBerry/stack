'use strict';

const ethers = require('ethers');

const Inventory = require('./Inventory.js');
const NutBerryRuntime = require('./NutBerryRuntime.js');
const Utils = require('./Utils.js');

const FUNC_SIG_SUBMIT_BLOCK = '0x25ceb4b2';
const BIG_ZERO = BigInt(0);
const BIG_ONE = BigInt(1);

module.exports = class Block {
  constructor (prevBlock) {
    // previous block - if applicable
    this.prevBlock = prevBlock;
    // the blockHash - only available if this block was submitted to the Bridge.
    this.hash = '';
    // the blockNumber
    this.number = prevBlock ? prevBlock.number + BIG_ONE : BIG_ONE;
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
    this.prevBlock = prevBlock;
    this.inventory = prevBlock.inventory.clone();
    this.number = prevBlock.number + BIG_ONE;

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
      await this.addTransaction(tx.raw, bridge);
    }
    this.log(`Refactor:Complete ${this.transactionHashes.length} transactions left`);
  }

  async addTransaction (data, bridge) {
    const tx = ethers.utils.parseTransaction(data);

    tx.gasPrice = tx.gasPrice.toHexString();
    tx.gasLimit = tx.gasLimit.toHexString();
    tx.value = tx.value.toHexString();
    tx.from = tx.from.toLowerCase();
    tx.to = tx.to.toLowerCase();
    tx.raw = data;
    tx.nonce = BigInt(tx.nonce);

    const expectedNonce = this.nonces[tx.from] || BIG_ZERO;

    if (this.validateTransaction(tx, expectedNonce)) {
      const { errno, returnValue, logs } = await this.executeTx(tx, bridge);

      this.log(`${tx.from}:${tx.nonce}:${tx.hash}`);

      // TODO
      // check modified storage keys, take MAX_SOLUTION_SIZE into account
      if (errno !== 0) {
        this.log('invalid tx', tx.hash);
      }

      tx.logs = logs;
      this.nonces[tx.from] = tx.nonce + BIG_ONE;
      this.inventory.trackNonce(tx.from, tx.nonce + BIG_ONE);
      this.transactions[tx.hash] = tx;
      this.transactionHashes.push(tx.hash);

      return tx.hash;
    }

    this.log('invalid or duplicate tx', tx.hash);

    return null;
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

  async dryExecuteTx (tx, bridge) {
    const { errno, returnValue, logs } = await this.executeTx(tx, bridge, true);

    if (errno !== 0) {
      return '0x';
    }

    return returnValue;
  }

  async executeTx (tx, bridge, dry) {
    const customEnvironment = this.inventory.clone();

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
      const code = Utils.toUint8Array(await bridge.rootProvider.getCode(tx.to));
      const data = Utils.toUint8Array(tx.data);
      const address = Buffer.from(tx.to.replace('0x', ''), 'hex');
      const origin = Buffer.from(tx.from.replace('0x', ''), 'hex');
      const caller = origin;
      const runtime = new NutBerryRuntime();
      const state = await runtime.run({ address, origin, caller, code, data, customEnvironment });

      if (state.errno !== 0) {
        this.log('STATE ERROR', state.errno, tx.hash, tx.from, tx.nonce);
      } else {
        if (!dry) {
          this.inventory = customEnvironment;
        }
      }

      return {
        errno: state.errno,
        returnValue: `0x${state.returnValue.toString('hex')}`,
        logs: state.errno === 0 ? state.logs : [],
      };
    }

    // not a contract
    const msgSender = tx.from.toLowerCase();
    const target = tx.to.toLowerCase();
    const data = tx.data.replace('0x', '');
    const [ret, logs] = customEnvironment.handleCall(msgSender, target, data);
    const errno = ret === '0x' ? 7 : 0;

    if (errno === 0 && !dry) {
      this.inventory = customEnvironment;
    }

    // TODO
    return {
      errno: errno,
      returnValue: ret,
      logs,
    };
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
    const hashes = this.transactionHashes;
    const transactions = [];

    // TODO
    // this also has to take MAX_SOLUTION_SIZE into account
    let payloadLength = 0;
    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i];
      let tx = this.transactions[hash];
      // rsv and so on
      tx = ethers.utils.parseTransaction(tx.raw);

      this.log('Preparing ' + tx.from + ':' + tx.nonce + ':' + tx.hash);

      const encoded = Utils.encodeTx(tx).replace('0x', '');
      const byteLength = encoded.length / 2;

      if (payloadLength + byteLength > bridge.MAX_BLOCK_SIZE) {
        this.log('reached MAX_BLOCK_SIZE');
        break;
      }

      transactions.push(encoded);
    }

    const rawData = transactions.join('');
    const txData = {
      to: bridge.contract.address,
      data: FUNC_SIG_SUBMIT_BLOCK + rawData,
      value: bridge.BOND_AMOUNT,
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
    const storageKeys = this.inventory.storageKeys;
    const keys = Object.keys(storageKeys);

    this.log('Block.computeSolution');
    this.log(storageKeys);

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

    if (buf.length > bridge.MAX_SOLUTION_SIZE) {
      throw new Error('Reached MAX_SOLUTION_SIZE');
    }

    const solution = {
      buffer: buf,
      hash: ethers.utils.solidityKeccak256(['bytes'], [buf]),
    };

    this.log('==================================================================================');
    this.log(solution);
    this.log('==================================================================================');

    return solution;
  }
};
