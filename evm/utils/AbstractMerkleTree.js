'use strict';

const ethers = require('ethers');
const { ZERO_HASH } = require('./constants');

module.exports = class AbstractMerkleTree {
  static hash (left, right) {
    return ethers.utils.solidityKeccak256(
      ['bytes32', 'bytes32'],
      [left, right]
    );
  }

  static zero () {
    return {
      left: {
        hash: ZERO_HASH,
      },
      right: {
        hash: ZERO_HASH,
      },
      hash: ZERO_HASH,
    };
  }

  constructor () {
    this.tree = [[]];
  }

  get leaves () {
    return this.tree[0];
  }

  get root () {
    return this.tree[this.tree.length - 1][0];
  }

  get depth () {
    // we also count leaves
    return this.tree.length;
  }

  getNode (hash) {
    let len = this.tree.length;

    while (len--) {
      let x = this.tree[len];

      let iLen = x.length;
      while (iLen--) {
        let y = x[iLen];
        if (y.hash === hash) {
          return y;
        }
      }
    }

    return null;
  }

  getPair (leftHash, rightHash) {
    let len = this.tree.length;

    while (len--) {
      let x = this.tree[len];

      let iLen = x.length;
      while (iLen--) {
        let y = x[iLen];
        if (y.left.hash === leftHash && y.right.hash === rightHash) {
          return y;
        }
      }
    }

    return null;
  }

  recal (baseLevel) {
    if (baseLevel === undefined) {
      baseLevel = 0;
    }
    let level = baseLevel + 1;
    // clear everything from level and above
    this.tree = this.tree.slice(0, level);
    while (true) {
      let last = this.tree[level - 1];
      let cur = [];

      if (last.length <= 1 && level > 1) {
        // done
        break;
      }

      let len = last.length;
      for (let i = 0; i < len; i += 2) {
        let left = last[i];
        let right = last[i + 1];

        if (!right) {
          right = this.constructor.zero();
          last.push(right);
        }

        cur.push(
          {
            left: left,
            right: right,
            hash: this.constructor.hash(left.hash, right.hash),
          }
        );
      }

      this.tree.push(cur);
      level++;
    }
  }

  printTree () {
    let res = '';

    for (let i = 0; i < this.tree.length; i++) {
      const row = this.tree[i];

      res += `level ${i}: `;
      for (let y = 0; y < row.length; y++) {
        const e = row[y];
        const h = e.hash.substring(2, 6);
        const hl = e.left ? e.left.hash.substring(2, 6) : '?';
        const hr = e.right ? e.right.hash.substring(2, 6) : '?';

        res += ` [ ${h} (l:${hl} r:${hr}) ] `;
      }

      res += '\n';
    }

    return res;
  }

  clone () {
    const tree = [];
    //JSON.stringify(this.tree);
    for (let i = 0; i < this.tree.length; i++) {
      let t = this.tree[i];
      tree.push([].concat(t));
    }

    const res = new this.constructor();

    res.tree = tree;
    //JSON.parse(tree);

    return res;
  }

  scale (depth) {
    // TODO: revisit this
    if (depth === this.depth) {
      return this;
    }

    const wanted = 2 ** (depth - 1);

    if (depth < this.depth) {
      // scale down
      this.tree[0] = this.tree[0].slice(0, wanted);
    }

    if (depth > this.depth) {
      // scale up
      const leaves = this.leaves;
      for (let i = leaves.length; i < wanted; i++) {
        const left = leaves[i - 1].right || { hash: ZERO_HASH };

        leaves[i] = { left, right: { hash: ZERO_HASH }, hash: ZERO_HASH };
      }
    }

    // recalculate tree
    this.recal();

    return this;
  }

  /// @dev return hash proof for `slot`,
  /// `slot` is position in `this.leaves`.
  /// @return proof - array of 32 bytes hex-string (hashes)
  calculateProof (slot) {
    const proof = [];
    const len = this.depth - 1;

    for (let i = 0; i < len; i++) {
      proof.push(this.tree[i][slot ^ 1].hash);
      slot >>= 1;
    }
    return proof;
  }

  /// @dev verify if given `proofs` and `leaf` match `this.root.hash`
  verifyProof (leaf, proofs) {
    const len = proofs.length;
    let hash = leaf.hash;
    let slot = leaf.slot;

    for (let i = 0; i < len; i++) {
      const proof = proofs[i];

      if (slot % 2 === 0) {
        hash = this.constructor.hash(hash, proof);
      } else {
        hash = this.constructor.hash(proof, hash);
      }
      slot >>= 1;
    }

    return hash === this.root.hash;
  }
};
