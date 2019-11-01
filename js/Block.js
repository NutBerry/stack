'use strict';

const ethers = require('ethers');

const BerryInventory = require('./BerryInventory.js');
const NutBerryRuntime = require('./NutBerryRuntime.js');
const VerifierRuntime = require('./VerifierRuntime.js');
const Utils = require('./Utils.js');
const { Merkelizer } = require('./../evm/utils');
const { DEFAULT_CONTRACT } = require('./DefaultContract.js');
const DEFAULT_CONTRACT_CODE = Utils.toUint8Array(DEFAULT_CONTRACT);

module.exports = class Block {
  constructor (prevBlock, bridge) {
    // TODO: add support for chainId
    this.chainId = 0;
    // previous block - if applicable
    this.prevBlock = prevBlock;
    // the blockHash - only available if this block was submitted to the Bridge.
    this.hash = '';
    // the solution for this Block - only used as cache
    this.solution = null;
    // the blockNumber
    this.number = prevBlock ? prevBlock.number + 1 : 1;
    // the token inventory
    this.inventory = prevBlock ? prevBlock.inventory.clone() : new BerryInventory();
    // address > nonce mapping
    this.nonces = {};
    // txHash > tx mapping
    this.transactions = {};
    // ordered list of transaction hashes in this Block
    this.transactionHashes = [];
    // a counter to keep track of the deposits we applied already
    // TODO: do not use a counter, use something more robust
    this.appliedDeposits = 0;
    // array of addresses
    this.depositProof = [];

    if (prevBlock) {
      // copy nonces and apply new deposits since `prevBlock`
      this.appliedDeposits = prevBlock.appliedDeposits;
      this.applyDeposits(bridge);
      this.nonces = Object.assign({}, prevBlock.nonces);
    } else {
      // apply all deposits
      this.applyDeposits(bridge);
    }
  }

  addDeposit (obj, bridge) {
    this.inventory.addTokenFromBridge(obj, bridge.contract.address);
    this.appliedDeposits += 1;
  }

  applyDeposits (bridge) {
    for (let i = this.appliedDeposits; i < bridge.deposits.length; i++) {
      this.inventory.addTokenFromBridge(bridge.deposits[i], bridge.contract.address);
      this.appliedDeposits++;
    }
  }

  log (...args) {
    console.log(`Block(${this.number})`, ...args);
  }

  async refactor (prevBlock, bridge) {
    this.hash = null;
    this.solution = null;
    this.depositProof = [];

    this.prevBlock = prevBlock;
    this.inventory = prevBlock.inventory.clone();
    this.number = prevBlock.number + 1;

    this.log(`Refactor:Started ${this.transactionHashes.length} transactions`);

    this.appliedDeposits = prevBlock.appliedDeposits;
    this.applyDeposits(bridge);

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
      const returnValue = await this.executeTx(tx);

      this.log(`${tx.from}:${tx.nonce}:${tx.hash}`);

      if (!returnValue) {
        this.log('invalid tx', tx.hash);
        return;
      }

      // TODO: BigInt
      this.nonces[tx.from] = tx.nonce + 1;
      this.transactions[tx.hash] = tx;
      this.transactionHashes.push(tx.hash);
      return;
    }

    this.log('invalid or duplicate tx', tx.hash);
  }

  validateTransaction (tx, expectedNonce) {
    if (tx.nonce !== expectedNonce) {
      this.log('wrong nonce', { nonce: tx.nonce, expectedNonce });
      return false;
    }

    if (tx.chainId !== this.chainId) {
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

  async executeTx (tx) {
    const runtime = new NutBerryRuntime();
    const customEnvironment = this.inventory;
    const code = DEFAULT_CONTRACT_CODE;
    const data = Utils.toUint8Array(tx.data);
    const address = Buffer.from(tx.to.replace('0x', ''), 'hex');
    const origin = Buffer.from(tx.from.replace('0x', ''), 'hex');
    // TODO: copy / snapshot inventory
    const state = await runtime.run({ address, origin, code, data, customEnvironment });

    if (state.errno !== 0) {
      // TODO: revert state once we support arbitrary contracts
      this.log('STATE ERROR', state.errno, tx.hash, tx.from, tx.nonce);
      return '';
    }

    return `0x${state.returnValue.toString('hex')}`;
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

  async submitBlock (bridge) {
    // TODO: check for MAX_PAYLOAD_SIZE
    const hashes = this.transactionHashes;
    const transactions = [];

    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i];
      let tx = this.transactions[hash];
      // rsv and so on
      tx = ethers.utils.parseTransaction(tx.raw);
      const nonce = tx.nonce;

      this.log('Checking ' + tx.from + ':' + tx.nonce + ':' + tx.hash);
      // TODO: use BigInt
      const bridgeNonce = (await bridge.contract.getNonce(tx.from)).toNumber();

      // Bad transaction
      if (nonce < bridgeNonce) {
        continue;
      }

      const encoded = ethers.utils.serializeTransaction(
        {
          to: tx.to,
          data: tx.data,
          nonce: tx.nonce,
          chainId: tx.networkId,
        }
      );

      transactions.push(encoded.replace('0x', ''));
      transactions.push(tx.r.replace('0x', ''));
      transactions.push(tx.s.replace('0x', ''));
      transactions.push(tx.v.toString(16).padStart(2, '0'));
    }

    const rawData = transactions.join('');
    const txData = {
      to: bridge.contract.address,
      data: '0x25ceb4b2' + rawData,
    };

    // post data
    let tx = await bridge.signer.sendTransaction(txData);
    tx = await tx.wait();

    Utils.dumpLogs(tx.logs, bridge.contract.interface);

    this.log('Block.submitBlock.postData', tx.gasUsed.toString());
    this.log(
      {
        total: hashes.length,
        submitted: transactions.length / 4,
      }
    );

    const blockRaw = '0x64ef39ca' + rawData;
    const blockHash = ethers.utils.keccak256(blockRaw);

    return blockHash;
  }

  /// @dev Computes the solution for this Block.
  // TODO: Computational expensive tasks like this
  // should run in its own isolate or separate process.
  async computeSolution (bridge, doItWrong) {
    this.log('Block.computeSolution');

    if (this.solution) {
      this.log('solution already computed');
      return this.solution;
    }

    const verifierRuntime = new VerifierRuntime();
    const bridgeAddr = bridge.contract.address.toLowerCase();
    // TODO: cache the code
    const code = Utils.toUint8Array(await bridge.contract.provider.getCode(bridgeAddr));
    const myAddr = bridge.signer.address.toLowerCase();
    const address = Buffer.from(bridgeAddr.replace('0x', ''), 'hex');
    const origin = Buffer.from(myAddr.replace('0x', ''), 'hex');
    const callData = Utils.toUint8Array(this.raw);

    const state = await verifierRuntime.run(
      {
        address,
        origin,
        code,
        data: callData,
        customEnvironment: bridge.contract,
      }
    );

    if (state.errno === 0xff) {
      // TODO: handle this better
      throw new Error('state.errno === 0xff - likely that a call to the root rpc provider failed');
    }

    let resultStr = state.returnValue.toString('hex').replace('0x', '');

    if (doItWrong) {
      this.log('BadNodeMode!');

      let inv = false;
      for (let i = state.steps.length - 1; i > 0; i--) {
        const step = state.steps[i];

        // find CALLDATACOPY
        if (step.callDataReadLow !== -1 && step.memWriteLow !== -1) {
          step.pc += 1;
          inv = true;
          break;
        }
      }
      if (!inv) {
        state.steps.shift();
      }

      resultStr = resultStr + resultStr;
      state.steps[state.steps.length - 1].returnData = Buffer.from(resultStr, 'hex');
    }

    const resultHash = ethers.utils.solidityKeccak256(['bytes'], ['0x' + resultStr]);
    const tree = new Merkelizer().run(state.steps, code, callData);

    this.log('==================================================================================');
    this.log(
      {
        depth: tree.depth,
        result: resultStr,
        resultHash,
        pathRoot: tree.root.hash,
        errno: state.errno,
      }
    );
    this.log('==================================================================================');

    // cache the result
    this.solution = { tree, result: resultStr, resultHash, errno: state.errno };

    return this.solution;
  }

  // @dev For testing
  async computeWrongSolution (bridge) {
    return this.computeSolution(bridge, true);
  }
};
