'use strict';

const ZERO_LOGS_BLOOM = `0x${''.padStart(512, '0')}`;
const ZERO_NONCE = '0x0000000000000000';
const ZERO_HASH = `0x${''.padStart(64, '0')}`;

module.exports = class Methods {
  static 'debug_submitBlock' (obj, bridge) {
    return bridge.submitBlock();
  }

  static 'debug_submitSolution' (obj, bridge) {
    return bridge.submitSolution(BigInt(obj.params[0]));
  }

  static 'debug_finalizeSolution' (obj, bridge) {
    return bridge.finalizeSolution(BigInt(obj.params[0]));
  }

  static 'debug_directReplay' (obj, bridge) {
    return bridge.directReplay(BigInt(obj.params[0]));
  }

  static 'debug_kill' () {
    setTimeout(function () {
      process.exit(1);
    }, 10);

    return true;
  }

  static 'debug_haltEvents' (obj, bridge) {
    bridge._debugHaltEvents = obj.params[0] ? true : false;
    return bridge._debugHaltEvents;
  }

  static 'debug_forwardChain' (obj, bridge) {
    return bridge.forwardChain();
  }

  static 'debug_storage' (obj, bridge) {
    return bridge.pendingBlock.inventory.storage;
  }

  static 'web3_clientVersion' (obj, bridge) {
    return bridge.contract.address;
  }

  static 'net_version' (obj, bridge) {
    return 0;
  }

  static 'eth_gasPrice' (obj) {
    // always zero, Hooray 🎉
    return '0x00';
  }

  static async 'eth_blockNumber' (obj, bridge) {
    return `0x${bridge.pendingBlock.number.toString(16)}`;
  }

  static async 'eth_getBlockByNumber' (obj, bridge) {
    const num = BigInt(obj.params[0]);
    // TODO
    const withTxData = obj.params[1] ? true : false;
    const block = await bridge.getBlockByNumber(num, true);

    if (!block) {
      return null;
    }

    const prevBlock = bridge.prevBlock;
    const transactions = block.transactionHashes;

    return {
      hash: block.hash || ZERO_HASH,
      parentHash: prevBlock ? prevBlock.hash : ZERO_HASH,
      number: `0x${block.number.toString(16)}`,
      // TODO: implement timestamp
      timestamp: '0x0',
      // TODO: implement block nonce
      nonce: block.nonce || ZERO_NONCE,
      difficulty: '0x0',
      gasLimit: '0x0',
      gasUsed: '0x0',
      miner: '0x0000000000000000000000000000000000000000',
      extraData: '0x',
      transactions,
    };
  }

  static async 'eth_getBalance' (obj) {
    // always zero
    return '0x00';
  }

  static async 'eth_getTransactionCount' (obj, bridge) {
    // TODO: pending, latest
    // currently returns pending-nonce
    const nonce = await bridge.getNonce(obj.params[0]);
    return `0x${nonce.toString(16)}`;
  }

  static async 'eth_estimateGas' (obj) {
    // always zero
    return '0x00';
  }

  static async 'eth_getTransactionReceipt' (obj, bridge) {
    const txHash = obj.params[0];
    const { block, tx, txIndex } = bridge.pendingBlock.getBlockOfTransaction(txHash);

    if (!tx) {
      return null;
    }

    const transactionIndex = `0x${txIndex.toString(16)}`;
    const blockHash = block.hash || ZERO_HASH;
    const blockNumber = `0x${block.number.toString(16)}`;
    const logs = [];

    if (tx.logs) {
      const logLen = tx.logs.length;

      for (let i = 0; i < logLen; i++) {
        const logIndex = `0x${i.toString(16)}`;
        const log = tx.logs[i];
        const obj = {
          transactionLogIndex: logIndex,
          transactionIndex,
          blockNumber,
          transactionHash: txHash,
          address: log.address,
          topics: log.topics,
          data: log.data,
          logIndex,
          blockHash,
        };
        logs.push(obj);
      }
    }

    // TODO: proper receipts
    return {
      transactionHash: txHash,
      transactionIndex,
      blockHash,
      blockNumber,
      from: tx.from,
      to: tx.to,
      cumulativeGasUsed: '0x00',
      gasUsed: '0x00',
      contractAddress: null,
      logs: logs,
      logsBloom: ZERO_LOGS_BLOOM,
      status: tx.status,
    };
  }

  static async 'eth_getTransactionByHash' (obj, bridge) {
    const txHash = obj.params[0];
    const { block, tx, txIndex } = bridge.pendingBlock.getBlockOfTransaction(txHash);

    if (!tx) {
      return null;
    }

    const transactionIndex = `0x${txIndex.toString(16)}`;
    const blockHash = block.hash || ZERO_HASH;
    const blockNumber = `0x${block.number.toString(16)}`;

    return {
      transactionIndex,
      blockHash,
      blockNumber,
      from: tx.from,
      r: tx.r,
      s: tx.s,
      v: tx.v,
      value: '0x0',
      to: tx.to,
      hash: txHash,
      data: tx.data,
      nonce: '0x' + tx.nonce.toString(16),
      gasPrice: '0x0',
      gasLimit: '0x0',
    };
  }

  static async 'eth_call' (obj, bridge) {
    const block = obj.params[1];
    // from, to, data, gas, gasPrice, value
    const tx = obj.params[0];
    return bridge.runCall(tx);
  }

  static async 'eth_getCode' (obj, bridge) {
    return bridge.getCode(obj.params[0], obj.params[1]);
  }

  static async 'eth_sendRawTransaction' (obj, bridge) {
    const data = obj.params[0];
    return bridge.runTx({ data });
  }

  static async 'eth_getLogs' (obj, bridge) {
    // TODO
    // Support
    // - blockhash filter
    // - nested topic queries
    // - pending, earliest ..
    // - correct log indices
    const eventFilter = obj.params[0];
    const filterAddress = eventFilter.address ? eventFilter.address.toLowerCase() : null;
    const filterTopics = eventFilter.topics || [];
    const res = [];
    const end = BigInt(eventFilter.toBlock || bridge.pendingBlock.number);
    let start = BigInt(eventFilter.fromBlock || bridge.pendingBlock.number);

    for (; start <= end; start++) {
      const block = await bridge.getBlockByNumber(start, false);

      if (!block) {
        break;
      }

      const blockHash = block.hash || ZERO_HASH;
      const blockNumber = `0x${block.number.toString(16)}`;
      const txsLength = block.transactionHashes.length;

      for (let txIndex = 0; txIndex < txsLength; txIndex++) {
        const txHash = block.transactionHashes[txIndex];
        const tx = block.transactions[txHash];

        if (filterAddress && tx.to !== filterAddress) {
          continue;
        }

        const transactionIndex = `0x${txIndex.toString(16)}`;
        const logsLength = tx.logs.length;
        for (let logIndex = 0; logIndex < logsLength; logIndex++) {
          const log = tx.logs[logIndex];
          const filterTopicsLength = filterTopics.length;
          let skip = false;

          for (let t = 0; t < filterTopicsLength; t++) {
            const q = filterTopics[t];
            if (!q || log.topics[t] !== q) {
              skip = true;
              break;
            }
          }
          if (skip) {
            continue;
          }

          const idx = `0x${logIndex.toString(16)}`;
          const obj = {
            transactionLogIndex: idx,
            transactionIndex,
            blockNumber,
            transactionHash: txHash,
            address: log.address,
            topics: log.topics,
            data: log.data,
            logIndex: idx,
            blockHash,
          };

          res.push(obj);
        }
      }
    }

    return res;
  }

  // TODO
  // eth_getStorageAt
};
