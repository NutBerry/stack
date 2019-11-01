'use strict';

const ZERO_HASH_BUF = new Uint8Array(32);

module.exports = class ProofHelper {
  static constructProof (computationPath, { merkle }) {
    const left = merkle.exec[computationPath.left.index];
    const right = merkle.exec[computationPath.right.index];

    let isMemoryRequired = false;
    if (right.memReadHigh !== -1 || right.memWriteHigh !== -1) {
      isMemoryRequired = true;
    }
    let isCallDataRequired = false;
    if (right.callDataReadHigh !== -1) {
      isCallDataRequired = true;
    }

    const proofs = {
      stackHash: right.compactStackHash,
      memHash: isMemoryRequired ? ZERO_HASH_BUF : left.memHash,
      dataHash: isCallDataRequired ? ZERO_HASH_BUF : merkle.dataHash,
    };

    return {
      proofs,
      executionInput: {
        data: isCallDataRequired ? merkle.data : new Uint8Array(0),
        stack: right.compactStack,
        mem: isMemoryRequired ? left.mem : new Uint8Array(0),
        returnData: left.returnData,
        pc: left.pc,
        stackSize: left.stackSize,
        memSize: left.memSize,
      },
    };
  }
};
