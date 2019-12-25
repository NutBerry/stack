'use strict';

const ZERO_LOGS_BLOOM = `0x${''.padStart(512, '0')}`;
const ZERO_NONCE = '0x0000000000000000';
const ZERO_HASH = `0x${''.padStart(64, '0')}`;

module.exports = class Methods {
  static 'debug_submitBlock' (obj, bridge) {
    return bridge.submitBlock();
  }

  static 'debug_submitSolution' (obj, bridge) {
    return bridge.submitSolution(obj.params[0]);
  }

  static 'debug_finalizeSolution' (obj, bridge) {
    return bridge.finalizeSolution(obj.params[0]);
  }

  static 'debug_directReplay' (obj, bridge) {
    return bridge.directReplay(obj.params[0]);
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

  static 'web3_clientVersion' (obj, bridge) {
    return bridge.contract.address;
  }

  static 'net_version' (obj, bridge) {
    return bridge.chainId;
  }

  static 'eth_gasPrice' (obj) {
    // always zero, Hooray 🎉
    return '0x00';
  }

  static async 'eth_blockNumber' (obj, bridge) {
    return `0x${bridge.currentBlock.number.toString(16)}`;
  }

  static async 'eth_getBlockByNumber' (obj, bridge) {
    // TODO
    const num = parseInt(obj.params[0], 16);
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
      nonce: ZERO_NONCE,
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
    return bridge.getNonce(obj.params[0]);
  }

  static async 'eth_estimateGas' (obj) {
    // always zero
    return '0x00';
  }

  static async 'eth_getTransactionReceipt' (obj, bridge) {
    const txHash = obj.params[0];
    const { block, tx, txIndex } = bridge.currentBlock.getBlockOfTransaction(txHash);

    if (!tx) {
      return null;
    }

    // TODO: proper receipts
    const status = block === bridge.currentBlock ? '0x1' : '0x2';
    return {
      transactionHash: txHash,
      transactionIndex: `0x${txIndex.toString(16)}`,
      blockHash: block.hash || ZERO_HASH,
      blockNumber: `0x${block.number.toString(16)}`,
      from: tx.from,
      to: tx.to,
      cumulativeGasUsed: '0x00',
      gasUsed: '0x00',
      contractAddress: null,
      logs: [],
      logsBloom: ZERO_LOGS_BLOOM,
      status,
    };
  }

  static async 'eth_getTransactionByHash' (obj, bridge) {
    const txHash = obj.params[0];
    const tx = bridge.getTransaction(txHash);

    if (!tx) {
      return null;
    }

    return {
      raw: tx.raw,
      from: tx.from,
      value: tx.value,
      to: tx.to,
      hash: tx.hash,
      data: tx.data,
      nonce: '0x' + tx.nonce.toString(16),
      gasPrice: tx.gasPrice,
      gasLimit: tx.gasLimit,
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

  // TODO
  // eth_getLogs
  // eth_getStorageAt
};
