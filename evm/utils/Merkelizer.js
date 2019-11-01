'use strict';

const ethers = require('ethers');

const Keccak = require('./keccak256');
const AbstractMerkleTree = require('./AbstractMerkleTree');
const { ZERO_HASH } = require('./constants');
const ZERO_HASH_BUF = new Uint8Array(32);

const HEXMAP = {};
for (let i = 0; i <= 0xff; i++) {
  HEXMAP[i.toString(16).padStart(2, '0')] = i;
}

const TMP_BUF = new Uint8Array(32);

function updateUint (hash, val) {
  TMP_BUF.fill(0);

  TMP_BUF[31] = val & 0xff;
  TMP_BUF[30] = (val >>> 8) & 0xff;
  TMP_BUF[29] = (val >>> 16) & 0xff;
  TMP_BUF[28] = (val >>> 24) & 0xff;

  return hash.update(TMP_BUF);
}

module.exports = class Merkelizer extends AbstractMerkleTree {
  static toBuffer (str) {
    const len = str.length;
    const buf = new Uint8Array(len * 2);

    for (let i = 0; i < len; i += 2) {
      buf[i] = HEXMAP[str.substring(i, i + 2)];
    }

    return buf;
  }

  /// @notice If the first (left-most) hash is not the same as this,
  /// then the solution from that player is invalid.
  static initialStateHash (code, callData) {
    const res = {
      executionState: {
        compactStack: [],
        stack: [],
        mem: [],
        returnData: new Uint8Array(0),
        pc: 0,
        errno: 0,
        stackSize: 0,
        memSize: 0,
        stackHash: this.stackHash([]),
        memHash: this.memHash([]),
      },
    };

    res.hash = this.stateHash(res.executionState, this.dataHash(callData));

    return res;
  }

  static stackHashes (stack, sibling) {
    const res = sibling || ZERO_HASH_BUF;
    const hashes = [res];
    const len = stack.length;

    if (len === 0) {
      return hashes;
    }

    const hash = new Keccak();

    hash.update(res);
    for (let i = 0; i < len; i++) {
      const val = stack[i];

      hash.update(val);

      if (i !== len - 1) {
        const buf = hash.digest();
        hashes.push(buf);
        hash.reset();
        hash.update(buf);
      }
    }

    hashes.push(hash.digest());
    return hashes;
  }

  static stackHash (stack, sibling) {
    const res = this.stackHashes(stack, sibling);
    return res[res.length - 1];
  }

  static memHash (mem) {
    const len = mem.length;
    const hash = new Keccak();

    for (let i = 0; i < len; i++) {
      hash.update(mem[i]);
    }

    return hash.digest();
  }

  static dataHash (data) {
    const hash = new Keccak();
    return hash.update(data).digest();
  }

  static preStateHash (execution, dataHash) {
    const hash = new Keccak();

    hash.update(execution.stackHash);
    hash.update(execution.memHash);
    hash.update(dataHash);

    updateUint(hash, execution.pc);
    updateUint(hash, execution.stackSize);
    updateUint(hash, execution.memSize);

    return hash.digest();
  }

  static stateHash (execution, dataHash) {
    const hash = new Keccak();

    // TODO: compact returnData
    hash.update(this.preStateHash(execution, dataHash));
    hash.update(this.dataHash(execution.returnData));

    const buf = hash.digest();
    let str = '0x';
    for (let i = 0; i < 32; i++) {
      str += buf[i].toString(16).padStart(2, '0');
    }

    return str;
  }

  run (executions, code, callData) {
    if (!executions || !executions.length) {
      throw new Error('You need to pass at least one execution step');
    }

    this.tree = [[]];

    const initialState = this.constructor.initialStateHash(code, callData);
    const leaves = this.tree[0];
    const callDataHash = this.constructor.dataHash(callData);
    this.dataHash = callDataHash;
    this.data = callData;
    this.code = code;
    this.exec = executions;

    let prevLeaf = { right: initialState };
    let len = executions.length;

    for (let i = 0; i < len; i++) {
      const exec = executions[i];
      const hash = this.constructor.stateHash(exec, this.dataHash);
      const llen = leaves.push(
        {
          left: prevLeaf.right,
          right: {
            hash: hash,
            index: i,
          },
          hash: this.constructor.hash(prevLeaf.right.hash, hash),
          isLeaf: true,
          isFirstExecutionStep: i === 0,
        }
      );

      prevLeaf = leaves[llen - 1];
    }

    this.recal(0);

    return this;
  }

  clone () {
    const res = super.clone();

    res.dataHash = this.dataHash;
    res.data = this.data;
    res.code = this.code;
    res.exec = this.exec;

    return res;
  }

  /// @notice Calculates a proof for `returnData` of the last execution step.
  /// @return Array
  computeResultProof () {
    const resultProof = [];
    let node = this.root;

    while (true) {
      let hash = node.right.hash;

      if (node.isLeaf) {
        if (node.right.hash === ZERO_HASH) {
          const left = this.exec[node.left.index];
          const preHash = this.constructor.preStateHash(left, this.dataHash);

          resultProof.push(preHash);
          resultProof.push(node.right.hash);
        } else {
          const right = this.exec[node.right.index];
          const preHash = this.constructor.preStateHash(right, this.dataHash);

          resultProof.push(node.left.hash);
          resultProof.push(preHash);
        }
        break;
      }

      resultProof.push(node.left.hash);
      resultProof.push(node.right.hash);

      if (hash === ZERO_HASH) {
        hash = node.left.hash;
      }
      node = this.getNode(hash);
    }

    return resultProof;
  }

  /// @notice Verifies a proof from `computeResultProof`.
  /// @return `true` if correct, else `false`
  verifyResultProof (resultProof, returnDataHash, rootHash) {
    const len = resultProof.length;

    if (len < 2 || (len % 2) !== 0) {
      return false;
    }

    // save those temporarily
    let tmpLeft = resultProof[len - 2];
    let tmpRight = resultProof[len - 1];
    if (tmpRight === ZERO_HASH) {
      resultProof[len - 2] =
        ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [tmpLeft, returnDataHash]);
    } else {
      resultProof[len - 1] =
        ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [tmpRight, returnDataHash]);
    }

    let valid = true;
    let parentHash = rootHash;
    for (let i = 0; i < len; i += 2) {
      const left = resultProof[i];
      const right = resultProof[i + 1];
      const hash = this.constructor.hash(left, right);

      if (hash !== parentHash) {
        valid = false;
        break;
      }

      if (right === ZERO_HASH) {
        parentHash = left;
      } else {
        parentHash = right;
      }
    }

    // restore the values we swapped above
    resultProof[len - 2] = tmpLeft;
    resultProof[len - 1] = tmpRight;

    return valid;
  }
};
