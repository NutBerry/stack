'use strict';

const ethers = require('ethers');

const Block = require('./Block.js');
const Utils = require('./Utils.js');

const BRIDGE_ABI = require('./BridgeAbi.js');

// Deposit(address,address,uint256)
const TOPIC_DEPOSIT = '0x5548c837ab068cf56a2c2479df0882a4922fd203edb7517321831d95078c5f62';
// BlockBeacon()
const TOPIC_BEACON = '0x98f7f6a06026bc1e4789634d93bff8d19b1c3b070cc440b6a6ae70bae9fec6dc';
// NewSolution(uint256,bytes32)
const TOPIC_SOLUTION = '0xc2c24b452cabde4a0f2fec2993e5af81879a802cba7b7b42cd2f42e3166a0e0b';

const FUNC_SIG_CHALLENGE = '0xd2ef7398';
const FUNC_SIG_FINALIZE = '0xd5bb8c4b';
const BIG_ZERO = BigInt(0);

/// @dev Glue for everything.
module.exports = class Bridge {
  constructor (options) {
    // TODO
    // consider implementing support for chainId (cross-chain transaction replay attacks)
    this.pendingBlock = new Block(null);
    this.debugMode = options.debugMode ? true : false;
    this.badNodeMode = options.badNodeMode ? true : false;
    this.eventCheckMs = options.eventCheckMs || 1000;

    this.rootProvider = new ethers.providers.JsonRpcProvider(options.rootRpcUrl);
    if (options.privKey) {
      this.signer = new ethers.Wallet(options.privKey, this.rootProvider);
    } else {
      this.log('Warning: No private key - Using random wallet');
      this.signer = ethers.Wallet.createRandom().connect(this.rootProvider);
    }

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
        const isERC721 = await this.contract.isERC721(token, value);
        const isERC20 = isERC721 ? false : true;
        const data = { address: token, owner: owner, value: value, isERC20, isERC721 };
        await this.onDeposit(data);
      };
    this.eventHandlers[TOPIC_BEACON] =
      async (evt) => {
        const tx = await this.rootProvider.getTransaction(evt.transactionHash);

        await this.onBlockBeacon(tx);
      };
    this.eventHandlers[TOPIC_SOLUTION] =
      async (evt) => {
        const { blockNumber, solutionHash } =
          this.contract.interface.events.NewSolution.decode(evt.data);

        await this.onSolution(blockNumber, solutionHash, evt);
      };

    this.init();
  }

  log (...args) {
    console.log(...args);
  }

  async init () {
    this.VERSION = await this.contract.VERSION();
    this.MAX_BLOCK_SIZE = await this.contract.MAX_BLOCK_SIZE();
    this.MAX_SOLUTION_SIZE = await this.contract.MAX_SOLUTION_SIZE();
    this.INSPECTION_PERIOD = await this.contract.INSPECTION_PERIOD();
    this.BOND_AMOUNT = await this.contract.BOND_AMOUNT();

    const rootProviderVersion = await this.rootProvider.send('web3_clientVersion', []);
    this.log(
      {
        rootRpcUrl: this.rootProvider.connection,
        rootNetwork: await this.rootProvider.getNetwork(),
        rootProviderVersion,
        bridge: this.contract.address,
        bridgeVersion: this.VERSION,
        MAX_BLOCK_SIZE: this.MAX_BLOCK_SIZE,
        MAX_SOLUTION_SIZE: this.MAX_SOLUTION_SIZE,
        INSPECTION_PERIOD: this.INSPECTION_PERIOD,
        BOND_AMOUNT: this.BOND_AMOUNT.toString(),
        wallet: this.signer.address,
        debugMode: this.debugMode,
        badNodeMode: this.badNodeMode,
        eventCheckMs: this.eventCheckMs,
      }
    );

    // this is our starting point
    const createdAtBlock = (await this.contract.createdAtBlock()).toNumber();
    const latestBlock = await this.rootProvider.getBlockNumber();

    // sync
    this.log('syncing...');
    this.eventFilter.fromBlock = createdAtBlock;
    for (let i = createdAtBlock; i <= latestBlock;)  {
      let toBlock = i + 100;
      if (toBlock > latestBlock) {
        toBlock = latestBlock;
      }
      this.eventFilter.toBlock = toBlock;
      this.log(`from: ${this.eventFilter.fromBlock} to: ${this.eventFilter.toBlock} / ${latestBlock}`);

      const res = await this.rootProvider.getLogs(this.eventFilter);
      const len = res.length;

      for (let i = 0; i < len; i++) {
        await this._dispatchEvent(res[i]);
      }

      i = toBlock + 1;
      this.eventFilter.fromBlock = i;
    }

    this.ready = true;
    this.log(
      'synced',
      {
        fromBlock: this.eventFilter.fromBlock,
        toBlock: this.eventFilter.toBlock,
      }
    );

    this._eventLoop();

    // Disable automatic submissions for testing or debugging purposes.
    if (this.debugMode) {
      this.log('Disabled update loop because of debugMode');
    }
  }

  async forwardChain () {
    // TODO
    // that needs to honour submission thresholds
    if (!this._pendingBlockSubmission && this.pendingBlock.transactionHashes.length) {
      this._pendingBlockSubmission = true;

      this.log('submitting block...');
      try {
        await this.pendingBlock.submitBlock(this);
      } catch (e) {
        this.log(e);
      }

      this._pendingBlockSubmission = false;
    }

    // finalize or submit solution, if possible
    {
      const next = BigInt((await this.contract.finalizedHeight()).add(1).toString());

      // we can do this for the next 256 pending blocks
      for (let i = 0; i < 256; i++) {
        const block = await this.getBlockByNumber(next + BigInt(i));

        if (!block || !block.hash) {
          break;
        }

        this.log(`forwardChain: checking ${block.number}`);

        // we found the next pending block
        // no solution yet?
        if (!block.submittedSolutionHash) {
          if (await this.submitSolution(block.number)) {
            this.log(`submitted solution for ${block.number}`);
          }
        } else {
          // ...has a submitted solution
          const mySolution = await block.computeSolution(this, this.badNodeMode);

          if (mySolution.hash !== block.submittedSolutionHash) {
            this.log(`dispute: ${block.number}`);
            let tx = await this.contract.dispute(block.number.toString());
            this.log(tx.hash);
            tx = await tx.wait();
          }
        }
      }

      // fetch the block after `finalizedHeight`
      const pendingBlock = await this.getBlockByNumber(next);
      if (!pendingBlock || !pendingBlock.hash) {
        return;
      }

      if (pendingBlock.submittedSolutionHash) {
        const mySolution = await pendingBlock.computeSolution(this, this.badNodeMode);

        if (mySolution.hash !== pendingBlock.submittedSolutionHash) {
          this.log('Different results, starting challenge...');
          await this._processChallenge(pendingBlock);
          return;
        }

        const canFinalize = await this.contract.canFinalizeBlock(pendingBlock.number.toString());
        this.log(`Can finalize pending block: ${pendingBlock.number}=${canFinalize}`);

        if (canFinalize) {
          const ok = await this.finalizeSolution(pendingBlock.number);
          this.log(`finalizeSolution: ${ok}`);
        } else {
          // cant finalize, maybe the solution is too young?
          const blockNow = await this.rootProvider.getBlockNumber();
          const submitted = pendingBlock.submittedSolutionTime;
          const diff = blockNow - submitted;

          if (diff > this.INSPECTION_PERIOD) {
            this.log(`${diff} > INSPECTION_PERIOD but can not finalize block, starting challenge...`);
            await this._processChallenge(pendingBlock);
          }
        }
      }
    }
  }

  async _eventLoop () {
    try {
      await this._fetchEvents();
      if (!this.debugMode) {
        await this.forwardChain();
      }
    } catch (e) {
      this.log(e);
    }
    setTimeout(this._eventLoop.bind(this), this.eventCheckMs);
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

      if (latestBlock >= this.eventFilter.fromBlock) {
        this.log('New root block(s). Checking for new events...');
        this.eventFilter.toBlock = latestBlock;

        const res = await this.rootProvider.getLogs(this.eventFilter);
        const len = res.length;

        this.log(`${len} new events`);
        for (let i = 0; i < len; i++) {
          await this._dispatchEvent(res[i]);
        }

        this.eventFilter.fromBlock = latestBlock + 1;
      }
    }
  }

  async onDeposit (data) {
    const block = new Block(this.pendingBlock.prevBlock);
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
    await this.addBlock(block);
  }

  async onBlockBeacon (tx) {
    const data = tx.data;
    const block = new Block(this.pendingBlock.prevBlock);
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
        const txLen = Utils.decodeTransactionLength(buf, offset);
        const rawTx = buf.slice(offset, offset += txLen);

        try {
          await block.addTransaction(rawTx, this);
        } catch (e) {
          this.log(e);
        }
      } catch (e) {
        this.log('TODO - proper tx parsing', e);
      }
    }

    this.log('Done');
    await this.addBlock(block);
  }

  /// @dev Checks if `blockNumber` is the next Block that needs finalization.
  async isCurrentBlock (blockNumber) {
    const finalizedHeight = await this.contract.finalizedHeight();

    if (finalizedHeight.add(1).eq(blockNumber.toString())) {
      return true;
    }

    return false;
  }

  async onSolution (blockNumber, solutionHash, evt) {
    this.log('Solution registered');
    this.log({ blockNumber, solutionHash });

    const block = await this.getBlockByNumber(BigInt(blockNumber));

    block.submittedSolutionHash = solutionHash;
    block.submittedSolutionTime = evt.blockNumber;
  }

  async getBlockByHash (hash) {
    let block = this.pendingBlock.prevBlock;

    while (block) {
      if (block.hash === hash) {
        return block;
      }
      block = block.prevBlock;
    }

    return null;
  }

  async getBlockByNumber (num, includePending) {
    if (includePending && num === this.pendingBlock.number) {
      return this.pendingBlock;
    }

    let block = this.pendingBlock.prevBlock;

    while (block) {
      if (block.number === num) {
        return block;
      }
      block = block.prevBlock;
    }

    return null;
  }

  async addBlock (block) {
    block.freeze();
    await this.pendingBlock.rebase(block, this);
  }

  async getNonce (addr) {
    const nonce = this.pendingBlock.nonces[addr.toLowerCase()];

    return nonce || BIG_ZERO;
  }

  getTransaction (txHash) {
    return this.pendingBlock.getTransaction(txHash);
  }

  async runCall (tx) {
    return this.pendingBlock.dryExecuteTx(tx, this);
  }

  async runTx ({ data }) {
    const txHash = await this.pendingBlock.addTransaction(data, this);

    if (!txHash) {
      throw new Error('Invalid transaction');
    }

    return txHash;
  }

  async getCode (addr) {
    return this.rootProvider.getCode(addr);
  }

  async submitBlock () {
    const blockNumber = await this.pendingBlock.submitBlock(this);

    return `0x${blockNumber.toString(16)}`;
  }

  async submitSolution (blockNumber) {
    const block = await this.getBlockByNumber(blockNumber);

    if (!block) {
      return false;
    }

    const mySolution = await block.computeSolution(this, this.badNodeMode);

    let tx = await this.contract.submitSolution(
      blockNumber.toString(), mySolution.hash
    );
    tx = await tx.wait();

    this.log('Bridge.submitSolution', tx.gasUsed.toString());

    return true;
  }

  async finalizeSolution (blockNumber) {
    const block = await this.getBlockByNumber(blockNumber);

    if (!block) {
      return false;
    }

    if (!(await this.isCurrentBlock(block.number))) {
      this.log('Bridge.finalizeSolution: already finalized');
      return true;
    }

    const mySolution = await block.computeSolution(this, this.badNodeMode);
    const txData = {
      to: this.contract.address,
      data: FUNC_SIG_FINALIZE +
            blockNumber.toString(16).padStart(64, '0') +
            Utils.bufToHex(mySolution.buffer, 0, mySolution.buffer.length).replace('0x', ''),
    };
    this.log('Bridge.finalizeSolution', mySolution);
    let tx = await this.signer.sendTransaction(txData);
    tx = await tx.wait();

    this.log('Bridge.finalizeSolution', tx.gasUsed.toString());

    return true;
  }

  async directReplay (blockNumber) {
    const block = await this.getBlockByNumber(blockNumber);

    if (!block) {
      return false;
    }

    await this._processChallenge(block);

    return true;
  }

  async _processChallenge (block) {
    const TAG = `Bridge.challenge(${block.number})`;
    const rootBlock = await this.rootProvider.getBlock('latest');
    const gasLimit = rootBlock.gasLimit.mul(10).div(11);
    const txData = {
      to: this.contract.address,
      data: block.raw.replace('0x', FUNC_SIG_CHALLENGE),
      gasLimit,
    };
    const cBlock = await this.contract.finalizedHeight();
    if (cBlock.gte(block.number.toString())) {
      this.log(TAG, 'ALREADY COMPLETED');
      return;
    }

    let cumulative = 0;
    try {
      let ctr = 0;
      while (true) {
        const lBlock = await this.contract.finalizedHeight();

        if (lBlock.gt(cBlock)) {
          // done
          this.log(TAG, 'done', cumulative);
          break;
        }
        let tx = await this.signer.sendTransaction(txData);
        tx = await tx.wait();
        cumulative += tx.cumulativeGasUsed.toNumber();

        ctr++;

        this.log(TAG, `step = ${ctr}`, tx.gasUsed.toString());
        Utils.dumpLogs(tx.logs, this.contract.interface);
      }
    } catch (e) {
      const cBlock = await this.contract.finalizedHeight();
      if (cBlock.gte(block.number.toString())) {
        this.log(TAG, 'ALREADY COMPLETED');
        return;
      }

      this.log(TAG, e);
    }
  }
};
