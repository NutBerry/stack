'use strict';

const ZERO_LOGS_BLOOM = `0x${''.padStart(512, '0')}`;

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

  static 'web3_clientVersion' (obj, bridge) {
    return bridge.contract.address;
  }

  static 'getDepositProof' (obj, bridge) {
    return bridge.getDepositProof();
  }

  static 'net_version' (obj, bridge) {
    return bridge.chainId;
  }

  static 'eth_gasPrice' (obj) {
    // always zero, Hooray 🎉
    return '0x00';
  }

  static async 'eth_blockNumber' (obj) {
    // TODO
    return '0x00';
  }

  static async 'eth_getBlockByNumber' (obj) {
    // TODO
  }

  static async 'eth_getBalance' (obj) {
    // always zero
    return '0x00';
  }

  static async 'eth_getTransactionCount' (obj, bridge) {
    return bridge.getNonce(obj.params[0]);
  }

  static async 'eth_estimateGas' (obj) {
    // always zero
    return '0x00';
  }

  static async 'eth_getTransactionReceipt' (obj, bridge) {
    const txHash = obj.params[0];
    const tx = bridge.getTransaction(txHash);

    if (!tx) {
      return null;
    }

    // TODO: proper receipts
    return {
      transactionHash: txHash,
      transactionIndex: '0x00',
      blockHash: txHash,
      blockNumber: '0x01',
      from: tx.from,
      to: tx.to,
      cumulativeGasUsed: '0x00',
      gasUsed: '0x00',
      contractAddress: null,
      logs: [],
      logsBloom: ZERO_LOGS_BLOOM,
      status: '0x01',
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
    return bridge.getCode(obj.params[1]);
  }

  static async 'eth_sendRawTransaction' (obj, bridge) {
    const data = obj.params[0];
    return bridge.runTx({ data });
  }

  // TODO
  // eth_getLogs
  // eth_getStorageAt
};
