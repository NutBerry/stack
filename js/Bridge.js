'use strict';

const ethers = require('ethers');

const BerryInventory = require('./BerryInventory.js');
const Block = require('./Block.js');
const NutBerryRuntime = require('./NutBerryRuntime.js');
const { DEFAULT_CONTRACT } = require('./DefaultContract.js');
const Utils = require('./Utils.js');

const BRIDGE_ABI = require('./BridgeAbi.js');
const DEFAULT_CONTRACT_CODE = Utils.toUint8Array(DEFAULT_CONTRACT);

// TODO: make that configurable via options
const UPDATE_CHECK_MS = 10000;
const EVENT_CHECK_MS = 1000;

// Deposit(address,address,uint256)
const TOPIC_DEPOSIT = '0x5548c837ab068cf56a2c2479df0882a4922fd203edb7517321831d95078c5f62';
// BlockBeacon()
const TOPIC_BEACON = '0x98f7f6a06026bc1e4789634d93bff8d19b1c3b070cc440b6a6ae70bae9fec6dc';
// NewSolution(bytes32,bytes32)
const TOPIC_SOLUTION = '0x8f83eb5964d76be4a4f1e1f29afb7dabf96121727cae0afe196f30d4e57e9a48';
// NewDispute(bytes32)
const TOPIC_DISPUTE = '0x16c365760145ef041452748ec5c20f2d9fb23924ea026eeb18935ff81e3238f9';
// Slashed(bytes32,bool)
const TOPIC_SLASHED = '0x6c48028c877b18aadc31081febd708cb0b41fb44ee7dd7bc071063b95c967029';
// DisputeNewRound(bytes32,uint256,bytes32,bytes32)
const TOPIC_DISPUTE_ROUND = '0xfcde97ca95164905ad9a9101e2555288c5efe5d7ebf5537871b534b5b0a0254d';

/// @dev Glue for everything.
module.exports = class Bridge {
  constructor (options) {
    // TODO: implement support for chainId (cross-chain transaction replay attacks)
    this.chainId = 0;
    this.debugMode = options.debugMode ? true : false;
    this.badNodeMode = options.badNodeMode ? true : false;
    this.deposits = [];
    this.blocks = [];

    this.rootProvider = new ethers.providers.JsonRpcProvider(options.rootRpcUrl);
    if (options.privKey) {
      this.signer = new ethers.Wallet(options.privKey, this.rootProvider);
    } else {
      this.log('Warning: No private key - Using random wallet');
      this.signer = ethers.Wallet.createRandom().connect(this.rootProvider);
    }
    // TODO
    global.provider = this.rootProvider;

    this.contract = new ethers.Contract(options.contract, BRIDGE_ABI, this.signer);
    this.currentBlock = new Block(null, this);
    this.eventFilter = {
      fromBlock: 0,
      toBlock: 0,
      address: this.contract.address,
      topics: null,
    };

    this.eventHandlers = {};
    this.eventHandlers[TOPIC_DEPOSIT] =
      async (evt) => {
        const o = this.contract.interface.events.Deposit.decode(evt.data);
        const value = '0x' + o.value.toHexString().replace('0x', '').padStart(64, '0');
        const owner = o.owner;
        const token = o.token;
        const data = { address: token, owner: owner, value: value, isERC20: true };
        await this.onDeposit(data);
      };
    this.eventHandlers[TOPIC_BEACON] =
      async (evt) => {
        const tx = await this.rootProvider.getTransaction(evt.transactionHash);

        await this.onBlockBeacon(tx);
      };
    this.eventHandlers[TOPIC_SOLUTION] =
      async (evt) => {
        const { blockHash, solutionHash } =
          this.contract.interface.events.Solution.decode(evt.data);

        await this.onSolution(blockHash, solutionHash, evt);
      };
    this.eventHandlers[TOPIC_DISPUTE] =
      async (evt) => {
        const { blockHash } =
          this.contract.interface.events.NewDispute.decode(evt.data);

        await this.onNewDispute(blockHash);
      };

    this.init();
  }

  log (...args) {
    console.log(...args);
  }

  async init () {
    this.bondAmount = await this.contract.BOND_AMOUNT();

    const rootProviderVersion = await this.rootProvider.send('web3_clientVersion', []);
    this.log(
      {
        rootRpcUrl: this.rootProvider.connection,
        rootNetwork: await this.rootProvider.getNetwork(),
        rootProviderVersion,
        bridge: this.contract.address,
        bridgeVersion: await this.contract.version(),
        bondAmount: this.bondAmount.toString(),
        wallet: this.signer.address,
        debugMode: this.debugMode,
        badNodeMode: this.badNodeMode,
      }
    );

    // this is our starting point
    const createdAtBlock = (await this.contract.createdAtBlock()).toNumber();
    const latestBlock = await this.rootProvider.getBlockNumber();

    // sync
    this.log('syncing...');
    for (let i = createdAtBlock; i <= latestBlock; i++)  {
      this.eventFilter.fromBlock = i;
      this.eventFilter.toBlock = i;

      const res = await this.rootProvider.getLogs(this.eventFilter);
      const len = res.length;

      for (let i = 0; i < len; i++) {
        await this._dispatchEvent(res[i]);
      }
    }

    this.log(
      'synced',
      {
        fromBlock: this.eventFilter.fromBlock,
        toBlock: this.eventFilter.toBlock,
      }
    );

    this._fetchEvents();

    // Disable automatic submissions for testing or debugging purposes.
    if (!this.debugMode) {
      this._updateLoop();
    }
  }

  async _updateLoop () {
    try {
      if (this.currentBlock.transactionHashes.length) {
        this.log('submitting block...');
        const blockHash = await this.currentBlock.submitBlock(this);
      }

      // TODO
      // Figure out the next pending block
      // const currentBlock = await this.contract.currentBlock();
      // if (currentBlock.add(1).eq(blockNumber))...

      if (this.pendingBlock) {
        if (!(await this.isCurrentBlock(this.pendingBlock.number))) {
          // we already moved on
          this.pendingBlock = null;
        } else {
          const canFinalize = await this.contract.canFinalizeBlock(this.pendingBlock.hash);

          this.log(`Can finalize pending block: ${canFinalize}`);
          if (canFinalize) {
            const ok = await this.finalizeSolution(this.pendingBlock.hash);
            if (ok) {
              this.pendingBlock = null;
            }
          }
        }
      } else {
        if (!this.debugMode) {
          const currentBlock = await this.contract.currentBlock();
          const block = await this.getBlockByNumber(currentBlock.add(1).toNumber());

          if (block) {
            // we found the next pending block
            if (await this.submitSolution(block.hash)) {
              this.pendingBlock = block;
            }
          }
        }
      }
    } catch (e) {
      this.log(e);
    }

    setTimeout(this._updateLoop.bind(this), UPDATE_CHECK_MS);
  }

  async _dispatchEvent (evt) {
    const topic = evt.topics[0];

    if (this.eventHandlers.hasOwnProperty(topic)) {
      await this.eventHandlers[topic](evt);
    }
  }

  async _fetchEvents ()  {
    const latestBlock = await this.rootProvider.getBlockNumber();

    if (latestBlock > this.eventFilter.fromBlock) {
      this.log('New root block(s). Checking for new events...');
      this.eventFilter.fromBlock += 1;
      this.eventFilter.toBlock = latestBlock;

      const res = await this.rootProvider.getLogs(this.eventFilter);
      const len = res.length;

      this.log(`${len} new events`);
      for (let i = 0; i < len; i++) {
        await this._dispatchEvent(res[i]);
      }

      this.eventFilter.fromBlock = latestBlock;
    }

    setTimeout(this._fetchEvents.bind(this), this.debugMode ? 30 : EVENT_CHECK_MS);
  }

  async onDeposit (data) {
    const block = new Block(this.blocks[this.blocks.length - 1], this);
    const pending = block.number;
    const raw =
      '0x' +
      data.owner.replace('0x', '').padStart(64, '0') +
      data.address.replace('0x', '').padStart(64, '0') +
      data.value.replace('0x', '') +
      pending.toString(16).padStart(64, '0');
    const blockHash = ethers.utils.keccak256(raw);
    block.addDeposit(data, this);

    block.raw = raw;
    block.hash = blockHash;

    this.log(`new Deposit-Block ${block.number}/${block.hash}`);
    this.addBlock(block);

    // TODO: queue this like all the other blocks
    try {
      await this.directReplay(block.hash);
    } catch (e) {
      this.log('directReplay', e);
    }
  }

  async onBlockBeacon (tx) {
    const data = tx.data;
    const block = new Block(this.blocks[this.blocks.length - 1], this);
    const raw = '0x' + data.substring(10, data.length);
    const blockHash = ethers.utils.keccak256(raw);

    block.raw = raw;
    block.hash = blockHash;

    this.log(`new Block ${block.number}/${block.hash}`);

    // TODO: validate and skip malformed transactions
    // 0x + function sig
    let offset = 10;
    while (true) {
      if (offset >= data.length) {
        break;
      }

      let nonce;
      let to;
      let digest;
      let callData;
      let txData;

      for (let i = 0; i <= 6; i++) {
        let lengthOfData = 0;
        let lengthField = 2;

        function _parseInt (offset, length) {
          let result = 0;
          for (let i = 0; i < length; i+=2) {
            let v = data.substring(offset + i, offset + i + 2);
            v = parseInt(v, 16);
            result = v + (result * 256);
          }
          return result * 2;
        }

        let val = parseInt(data.substring(offset, offset + 2), 16);

        if (val > 0xf7) {
          let len = (val - 0xf7) * 2;
          lengthOfData = _parseInt(offset + 2, len);
          lengthField += len;
        } else if (val > 0xbf) {
          let len = (val - 0xc0) * 2;
          lengthOfData = len;
        } else if (val > 0xb7) {
          let len = (val - 0xb7) * 2;
          lengthOfData = _parseInt(offset + 2, len);
          lengthField += len;
        } else if (val > 0x7f) {
          let len = (val - 0x80) * 2;
          lengthOfData = len;
        } else {
          lengthOfData = 2;
          lengthField = 0;
        }

        if (i === 0) {
          let txlen = lengthOfData + lengthField;

          txData = data.substring(offset, offset + txlen);
          digest = ethers.utils.keccak256(Buffer.from(txData, 'hex'));
          offset += lengthField;
          continue;
        }

        offset += lengthField;

        if (i === 1) {
          if (lengthOfData === 0) {
            nonce = 0;
          } else {
            nonce = data.substring(offset, offset + lengthOfData);
          }
        }

        // gasPrice, gasLimit, value
        // if (i === 2 || i === 3 || i === 5) {
        // }

        if (i === 4) {
          to = data.substring(offset, offset + lengthOfData);
        }

        if (i === 6) {
          callData = data.substring(offset, offset + lengthOfData);
        }
        offset += lengthOfData;
      }

      const r = '0x' + data.substring(offset, offset += 64);
      const s = '0x' + data.substring(offset, offset += 64);
      const v = '0x' + data.substring(offset, offset += 2);
      const from = ethers.utils.recoverAddress(
        Buffer.from(digest.replace('0x', ''), 'hex'), { r, s, v }
      );

      const tx = {
        from: from.toLowerCase(),
        to: '0x' + to,
        // TODO: use BigInt/hex-string
        nonce: parseInt(nonce, 16),
        data: '0x' + callData,
        chainId: 0,
        gasPrice: '0x00',
        gasLimit: '0x00',
        value: '0x00',
      };
      const rawHexStr = ethers.utils.serializeTransaction(
        { to: tx.to, data: tx.data, nonce: tx.nonce, chainId: this.chainId },
        { r, s, v }
      );
      tx.hash = ethers.utils.keccak256(rawHexStr);
      tx.raw = rawHexStr;

      await block.addTransaction(tx);
    }

    this.log('Done');
    this.addBlock(block);
  }

  /// @dev Checks if `blockNumber` is the current Block that needs finalization.
  async isCurrentBlock (blockNumber) {
    const currentBlock = await this.contract.currentBlock();

    if (currentBlock.add(1).eq(blockNumber)) {
      return true;
    }

    return false;
  }

  async onSolution (blockHash, solutionHash, evt) {
    this.log('Solution registered');
    this.log({ blockHash, solutionHash });

    const block = await this.getBlockByHash(blockHash);

    // already finalized
    if (!(await this.isCurrentBlock(block.number))) {
      this.log('Block is not the current active one. Skipping.');
      return;
    }

    const mySolution = await (this.badNodeMode ? block.computeWrongSolution(this) : block.computeSolution(this));

    if (mySolution.hash === solutionHash) {
      this.log('Block solution looks fine');
      // remember to finalize this one, once we can
      this.pendingBlock = block;
      return;
    }

    this.log('Different results, starting dispute...');

    try {
      const txData = {
        to: this.contract.address,
        value: this.bondAmount,
        data: block.raw.replace('0x', '0xf240f7c3'),
      };

      let tx = await this.signer.sendTransaction(txData);
      tx = await tx.wait();

      this.log('Bridge.dispute', tx.gasUsed.toString());
      Utils.dumpLogs(tx.logs, this.contract.interface);
    } catch (e) {
      this.log('starting dispute', e);
    }
  }

  async onNewDispute (blockHash) {
  }

  async getBlockByHash (hash) {
    // TODO: account for the duplicate blockHash situation
    let len = this.blocks.length;

    while (len--) {
      const block = this.blocks[len];

      if (block.hash === hash) {
        return block;
      }
    }

    return null;
  }

  async getBlockByNumber (num) {
    let len = this.blocks.length;

    while (len--) {
      const block = this.blocks[len];

      if (block.number === num) {
        return block;
      }
    }

    return null;
  }

  async addBlock (block) {
    this.blocks.push(block);
    await this.currentBlock.refactor(block, this);

    if (!this.debugMode) {
      try {
        if (await this.isCurrentBlock(block.number)) {
          await this.submitSolution(block.hash);
        }
      } catch (e) {
        this.log(e);
      }
    }
  }

  async getNonce (addr) {
    const nonce = this.currentBlock.nonces[addr.toLowerCase()];

    return nonce | 0;
  }

  getTransaction (txHash) {
    return this.currentBlock.getTransaction(txHash);
  }

  async runCall (tx) {
    const runtime = new NutBerryRuntime();
    const customEnvironment = this.currentBlock.inventory.clone();
    const code = DEFAULT_CONTRACT_CODE;
    const address = Buffer.from(tx.to.replace('0x', ''), 'hex');
    const data = Utils.toUint8Array(tx.data);
    const origin = tx.from ? Buffer.from(tx.from.toLowerCase().replace('0x', ''), 'hex') : undefined;
    const state = await runtime.run({ address, origin, code, data, customEnvironment });

    if (state.errno !== 0) {
      return '0x';
    }

    return `0x${state.returnValue.toString('hex')}`;
  }

  async runTx ({ data }) {
    const tx = ethers.utils.parseTransaction(data);

    tx.gasPrice = tx.gasPrice.toHexString();
    tx.gasLimit = tx.gasLimit.toHexString();
    tx.value = tx.value.toHexString();
    tx.from = tx.from.toLowerCase();
    tx.to = tx.to.toLowerCase();
    tx.raw = data;

    this.currentBlock.addTransaction(tx);
    return tx.hash;
  }

  async getCode (addr) {
    // TODO
    return DEFAULT_CONTRACT;
  }

  async submitBlock () {
    return this.currentBlock.submitBlock(this);
  }

  async submitSolution (blockHash) {
    const block = await this.getBlockByHash(blockHash);

    if (!block) {
      return false;
    }

    const solution = await block.computeSolution(this);

    let tx = await this.contract.submitSolution(
      blockHash, solution.hash,
      { value: this.bondAmount }
    );
    tx = await tx.wait();

    this.log('Bridge.submitSolution', tx.gasUsed.toString());

    return true;
  }

  async finalizeSolution (blockHash) {
    const block = await this.getBlockByHash(blockHash);

    if (!block) {
      return false;
    }

    if (!(await this.isCurrentBlock(block.number))) {
      this.log('Bridge.finalizeSolution: already finalized');
      return true;
    }

    this.log('Bridge.finalizeSolution', block.solution);
    let tx = await this.contract.finalizeSolution(blockHash, block.solution.buffer);
    tx = await tx.wait();
    this.log('Bridge.finalizeSolution', tx.gasUsed.toString());

    return true;
  }

  async directReplay (blockHash) {
    const block = await this.getBlockByHash(blockHash);

    if (!block) {
      return false;
    }

    const txData = {
      to: this.contract.address,
      data: block.raw.replace('0x', '0xb5b9cd7f'),
    };

    let tx = await this.signer.sendTransaction(txData);
    tx = await tx.wait();

    this.log('Bridge.directReplay', tx.gasUsed.toString());
    Utils.dumpLogs(tx.logs, this.contract.interface);

    return true;
  }
};
