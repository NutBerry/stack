'use strict';

const ethers = require('ethers');

const Block = require('./Block.js');
const Utils = require('./Utils.js');

const BRIDGE_ABI = require('./BridgeAbi.js');

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

const FUNC_SIG_REPLAY = '0xb5b9cd7f';
const FUNC_SIG_DISPUTE = '0xf240f7c3';

/// @dev Glue for everything.
module.exports = class Bridge {
  constructor (options) {
    // TODO
    // consider implementing support for chainId (cross-chain transaction replay attacks)

    this.blocks = [];
    this.currentBlock = new Block(null);
    this.debugMode = options.debugMode ? true : false;
    this.badNodeMode = options.badNodeMode ? true : false;
    this.eventCheckMs = options.eventCheckMs || 1000;
    this.updateCheckMs = options.updateCheckMs || 10000;

    this.rootProvider = new ethers.providers.JsonRpcProvider(options.rootRpcUrl);
    if (options.privKey) {
      this.signer = new ethers.Wallet(options.privKey, this.rootProvider);
    } else {
      this.log('Warning: No private key - Using random wallet');
      this.signer = ethers.Wallet.createRandom().connect(this.rootProvider);
    }
    // TODO - remove this
    global.provider = this.rootProvider;

    this.contract = new ethers.Contract(options.contract, BRIDGE_ABI, this.signer);
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
        bridgeVersion: await this.contract.VERSION(),
        bondAmount: this.bondAmount.toString(),
        wallet: this.signer.address,
        debugMode: this.debugMode,
        badNodeMode: this.badNodeMode,
        eventCheckMs: this.eventCheckMs,
        updateCheckMs: this.updateCheckMs,
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
    } else {
      this.log('Disabled update loop because of debugMode');
    }
  }

  async _updateLoop () {
    try {
      // TODO
      // that needs to honour submission thresholds
      if (this.currentBlock.transactionHashes.length) {
        this.log('submitting block...');
        const blockHash = await this.currentBlock.submitBlock(this);
      }

      // finalize or submit solution, if possible
      {
        const currentBlock = await this.contract.currentBlock();
        const block = await this.getBlockByNumber(currentBlock.add(1).toNumber());

        // we found the next pending block
        if (block && block.hash) {
          const canFinalize = await this.contract.canFinalizeBlock(block.hash);

          if (canFinalize) {
            this.log(`Can finalize pending block: ${canFinalize}`);

            const ok = await this.finalizeSolution(block.hash);
            this.log(`finalizeSolution: ${ok}`);
            return;
          }

          // no solution yet, submit one
          if (await this.submitSolution(block.hash)) {
            this.log(`submitted solution for ${block.number}`);
          }
        }
      }
    } catch (e) {
      this.log(e);
    }

    setTimeout(this._updateLoop.bind(this), this.updateCheckMs);
  }

  async _dispatchEvent (evt) {
    const topic = evt.topics[0];

    if (this.eventHandlers.hasOwnProperty(topic)) {
      await this.eventHandlers[topic](evt);
    }
  }

  async _fetchEvents ()  {
    if (!this._debugHaltEvents) {
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
    }

    setTimeout(this._fetchEvents.bind(this), this.eventCheckMs);
  }

  async onDeposit (data) {
    const block = new Block(this.blocks[this.blocks.length - 1]);
    const pending = block.number.toString(16).padStart(64, '0');
    const raw =
      '0x' +
      data.owner.replace('0x', '') +
      data.address.replace('0x', '') +
      data.value.replace('0x', '');
    const blockHash = ethers.utils.keccak256('0x' + pending + raw.replace('0x', ''));
    block.addDeposit(data);

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
    const block = new Block(this.blocks[this.blocks.length - 1]);
    const raw = '0x' + data.substring(10, data.length);
    const blockHash = ethers.utils.keccak256(
      '0x' + block.number.toString(16).padStart(64, '0') + raw.replace('0x', '')
    );

    block.raw = raw;
    block.hash = blockHash;

    this.log(`new Block ${block.number}/${block.hash}`);

    const buf = Utils.toUint8Array(raw);
    let offset = 0;
    while (true) {
      if (offset >= buf.length) {
        break;
      }

      try {
        let { nonce, to, calldata, len } = Utils.decode(buf, offset);

        nonce = Utils.bufToHex(nonce, 0, nonce.length);
        to = Utils.bufToHex(to, 0, 20);
        calldata = Utils.bufToHex(calldata, 0, calldata.length);
        offset += len;

        const r = Utils.bufToHex(buf, offset, offset += 32);
        const s = Utils.bufToHex(buf, offset, offset += 32);
        const v = Utils.bufToHex(buf, offset, offset += 1);
        const tx = {
          to,
          // TODO: use BigInt/hex-string
          nonce: parseInt(nonce, 16),
          data: calldata,
          gasLimit: '0x00',
          gasPrice: '0x00',
          value: '0x00',
          chainId: 0,
        };
        const unsigned = ethers.utils.serializeTransaction(tx);
        const signed = ethers.utils.serializeTransaction(tx, { r, s, v });
        const digest = ethers.utils.keccak256(unsigned);
        const from = ethers.utils.recoverAddress(
          Buffer.from(digest.replace('0x', ''), 'hex'), { r, s, v }
        );

        tx.hash = ethers.utils.keccak256(signed);
        tx.from = from.toLowerCase();
        tx.raw = signed;

        await block.addTransaction(tx);
      } catch (e) {
        this.log('TODO - proper tx parsing');
      }
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
      return;
    }

    this.log('Different results, starting dispute...');

    try {
      const txData = {
        to: this.contract.address,
        value: this.bondAmount,
        data: block.raw.replace('0x', FUNC_SIG_DISPUTE),
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

  async getBlockByNumber (num, includePending) {
    if (includePending && num === this.currentBlock.number) {
      return this.currentBlock;
    }

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
    return this.currentBlock.dryExecuteTx(tx);
  }

  async runTx ({ data }) {
    const tx = ethers.utils.parseTransaction(data);

    tx.gasPrice = tx.gasPrice.toHexString();
    tx.gasLimit = tx.gasLimit.toHexString();
    tx.value = tx.value.toHexString();
    tx.from = tx.from.toLowerCase();
    tx.to = tx.to.toLowerCase();
    tx.raw = data;

    const success = await this.currentBlock.addTransaction(tx);

    if (!success) {
      throw new Error('Invalid transaction');
    }

    return tx.hash;
  }

  async getCode (addr) {
    return this.rootProvider.getCode(addr);
  }

  async submitBlock () {
    return this.currentBlock.submitBlock(this);
  }

  async submitSolution (blockHash) {
    const block = await this.getBlockByHash(blockHash);

    if (!block) {
      return false;
    }

    const mySolution = await (this.badNodeMode ? block.computeWrongSolution(this) : block.computeSolution(this));

    let tx = await this.contract.submitSolution(
      blockHash, mySolution.hash,
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

    const mySolution = await (this.badNodeMode ? block.computeWrongSolution(this) : block.computeSolution(this));

    this.log('Bridge.finalizeSolution', mySolution);
    let tx = await this.contract.finalizeSolution(blockHash, mySolution.buffer);
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
      data: block.raw.replace('0x', FUNC_SIG_REPLAY),
    };

    let tx = await this.signer.sendTransaction(txData);
    tx = await tx.wait();

    this.log('Bridge.directReplay', tx.gasUsed.toString());
    Utils.dumpLogs(tx.logs, this.contract.interface);

    return true;
  }
};
