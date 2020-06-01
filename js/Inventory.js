'use strict';

const ethers = require('ethers');

const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_MAX = BigInt.asUintN(256, '-1');
const UINT_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
const UINT_ONE = '0x0000000000000000000000000000000000000000000000000000000000000001';

const TOPIC_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TOPIC_APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

function toStr (value, pad) {
  if (value === undefined) {
    return;
  }
  if (typeof value === 'string') {
    if (value.length > pad) {
      return value.replace('0x', '').slice(-pad);
    }
    return value.replace('0x', '').padStart(pad, '0');
  }
  return value.toString(16).padStart(pad, '0');
}

/// @notice Supports the following functions:
///
/// ERC20
///   - balanceOf (owner)
///   - allowance (owner, spender)
///   - transfer (to, value)
///
/// ERC721
///   - getApproved (tokenId)
///   - ownerOf (tokenId)
///
/// ERC20, ERC721, ERC1948, ERC1949
///   - approve (spender/to, value/tokenId)
///   - transferFrom (from, to, tokenId)
module.exports = class Inventory {
  static fromJSON (obj) {
    const ret = new this();
    ret.storage = Object.assign({}, obj.storage);
    ret.storageKeys = Object.assign({}, obj.storageKeys);

    return ret;
  }

  constructor () {
    this.storage = {};
    this.storageKeys = {};
  }

  toJSON () {
    const storage = this.storage;
    const storageKeys = this.storageKeys;

    return { storage, storageKeys };
  }

  clone () {
    const ret = this.toJSON();

    return this.constructor.fromJSON(ret);
  }

  freeze () {
    Object.freeze(this);
    Object.freeze(this.storage);
    Object.freeze(this.storageKeys);
  }

  _addERC20Exit (target, owner, value) {
    const k = ethers.utils.keccak256(
      Buffer.from(
        '9944279a' + toStr(owner, 40) + toStr(target, 40),
        'hex'
      )
    );
    const oldValue = BigInt(this.storageKeys[k] || 0);
    const newValue = toStr(oldValue + BigInt(value), 64);

    this.storageKeys[k] = `0x00${newValue}`;
    // Don't add this to storage. It's only relevant to the Bridge anyway.
    // this.storage[k] = `0x${newValue}`;
  }

  _addERC721Exit (target, tokenId, owner) {
    const k = ethers.utils.keccak256(
      Buffer.from(
        '2cf56c4e' + toStr(target, 40) + toStr(tokenId, 64),
        'hex'
      )
    );
    const value = toStr(owner, 64);

    this.storageKeys[k] = `0x01${value}`;
    // Don't add this to storage. It's only relevant to the Bridge anyway.
    // this.storage[k] = `0x${value}`;
  }

  _hashERC20 (target, owner) {
    const k = ethers.utils.keccak256(
      Buffer.from(
        '892c0be8' + toStr(target, 40) + toStr(owner, 40),
        'hex'
      )
    );

    return k;
  }

  _hashERC721 (target, tokenId) {
    const k = ethers.utils.keccak256(
      Buffer.from(
        '9ca0d15c' + toStr(target, 40) + toStr(tokenId, 64),
        'hex'
      )
    );

    return k;
  }

  _hashAllowance (target, owner, spender) {
    const k = ethers.utils.keccak256(
      Buffer.from(
        '0459bbcf' + toStr(target, 40) + toStr(owner, 40) + toStr(spender, 40),
        'hex'
      )
    );

    return k;
  }

  _hashApproval (target, tokenId) {
    const k = ethers.utils.keccak256(
      Buffer.from(
        '43837c20' + toStr(target, 40) + toStr(tokenId, 64),
        'hex'
      )
    );

    return k;
  }

  // TODO
  _hashStorage (target, key) {
    const k = ethers.utils.keccak256(
      Buffer.from(
        toStr(key, 64) + toStr(target, 64),
        'hex'
      )
    );
    return k;
  }

  _getValue (key) {
    return this.storage[key];
  }

  _setValue (key, value) {
    const padded = toStr(value, 64);
    this.storage[key] = `0x${padded}`;
    this.storageKeys[key] = `0x01${padded}`;
  }

  trackNonce (target, value) {
    const k = `0x${toStr(target, 64)}`;
    const val = toStr(value, 64);

    this.storageKeys[k] = `0x01${val}`;
    this.storage[k] = `0x${val}`;
  }

  addToken (e) {
    // index by owner for ERC20,
    // else index by value (tokenId)
    const address = e.address.toLowerCase();
    const owner = e.owner.toLowerCase();
    const value = e.value;

    if (e.isERC721) {
      this._setValue(this._hashERC721(address, value), owner);
    } else {
      const key = this._hashERC20(address, owner);
      const oldValue = BigInt(this._getValue(key) || '0');

      this._setValue(key, oldValue + BigInt(value));
    }
  }

  /// @notice ERC20 only.
  /// balanceOf
  '70a08231' (_, target, owner) {
    return [this._getValue(this._hashERC20(target, owner)) || UINT_ZERO, []];
  }

  /// @notice ERC20 only.
  /// allowance
  'dd62ed3e' (_, target, owner, spender) {
    return [this._getValue(this._hashAllowance(target, owner, spender)) || UINT_ZERO, []];
  }

  /// @notice ERC721, ERC1948, ERC1949  only.
  /// ownerOf
  '6352211e' (_, target, tokenId) {
    return [this._getValue(this._hashERC721(target, tokenId)) || UINT_ZERO, []];
  }

  /// @notice ERC721, ERC1948, ERC1949  only.
  /// getApproved
  '081812fc' (msgSender, target, tokenId) {
    const approval = this._getValue(this._hashApproval(target, tokenId));
    return [approval || UINT_ZERO, []];
  }

  // approve
  '095ea7b3' (msgSender, target, spender, value) {
    const isERC721 = this._getValue(this._hashERC721(target, value)) || UINT_ZERO;

    if (isERC721 !== UINT_ZERO) {
      if (isERC721 !== msgSender) {
        return [undefined, []];
      }

      this._setValue(this._hashApproval(target, value), spender);
      const logs = [
        {
          topics: [
            TOPIC_APPROVAL,
            msgSender,
            spender,
            value,
          ],
          data: '0x',
        },
      ];

      return [UINT_ONE, logs];
    }

    this._setValue(this._hashAllowance(target, msgSender, spender), value);
    const logs = [
      {
        topics: [
          TOPIC_APPROVAL,
          msgSender,
          spender,
        ],
        data: value,
      },
    ];

    return [UINT_ONE, logs];
  }

  /// @notice ERC20 only.
  /// transfer
  'a9059cbb' (msgSender, target, to, value) {
    if (value === UINT_ZERO) {
      return [undefined, []];
    }

    const senderKey = this._hashERC20(target, msgSender);
    const senderBalance = this._getValue(senderKey) || UINT_ZERO;

    if (senderBalance !== UINT_ZERO) {
      const has = BigInt(senderBalance);
      const want = BigInt(value);

      if (has >= want) {
        this._setValue(senderKey, has - want);

        if (to === UINT_ZERO) {
          this._addERC20Exit(target, msgSender, value);
        } else {
          const receiverKey = this._hashERC20(target, to);
          const old = BigInt(this._getValue(receiverKey) || '0');
          this._setValue(receiverKey, old + want);
        }

        const logs = [
          {
            topics: [
              TOPIC_TRANSFER,
              msgSender,
              to,
            ],
            data: value,
          },
        ];

        return [UINT_ONE, logs];
      }
    }

    return [undefined, []];
  }

  /// @notice ERC20, ERC721, ERC1948, ERC1949 only.
  /// transferFrom
  '23b872dd' (msgSender, target, from, to, value) {
    const senderKey = this._hashERC20(target, from);
    const senderBalance = this._getValue(senderKey);

    if (senderBalance !== undefined) {
      const allowanceKey = this._hashAllowance(target, from, msgSender);
      const allowance = BigInt(this._getValue(allowanceKey) || '0');
      const has = BigInt(senderBalance);
      const want = BigInt(value);

      // not enough
      if (has < want || (want > allowance && from !== msgSender) || want === BIGINT_ZERO) {
        return [undefined, []];
      }

      if (from !== msgSender && allowance !== BIGINT_MAX) {
        this._setValue(allowanceKey, allowance - want);
      }

      this._setValue(senderKey, has - want);

      if (to === UINT_ZERO) {
        this._addERC20Exit(target, msgSender, value);
      } else {
        // now update `to`
        const receiverKey = this._hashERC20(target, to);
        const oldValue = BigInt(this._getValue(receiverKey) || '0');
        this._setValue(receiverKey, oldValue + want);
      }

      const logs = [
        {
          topics: [
            TOPIC_TRANSFER,
            from,
            to,
          ],
          data: value,
        },
      ];

      return [UINT_ONE, logs];
    }

    // ERC721
    const nftKey = this._hashERC721(target, value);
    const owner = this._getValue(nftKey);

    if (owner !== undefined) {
      const approvalKey = this._hashApproval(target, value);

      if (owner !== msgSender) {
        const approved = this._getValue(approvalKey);
        if (approved !== msgSender) {
          return [undefined, []];
        }
      }

      this._setValue(approvalKey, UINT_ZERO);

      if (to === UINT_ZERO) {
        this._addERC721Exit(target, value, msgSender);
      }
      this._setValue(nftKey, to);
      const logs = [
        {
          topics: [
            TOPIC_TRANSFER,
            from,
            to,
            value,
          ],
          data: '0x',
        },
      ];
      return [UINT_ONE, logs];
    }

    return [undefined, []];
  }

  storageLoad (target, key) {
    return this._getValue(this._hashStorage(target, key)) || UINT_ZERO;
  }

  storageStore (target, key, value) {
    this._setValue(this._hashStorage(target, key), value);
  }

  handleCall (msgSender, target, data) {
    // pad up to 100 bytes
    data = data.padEnd(200, '0');
    let offset = 0;

    const funcSig = data.substring(offset, offset += 8);
    const arg1 = `0x${data.substring(offset, offset += 64)}`;
    const arg2 = `0x${data.substring(offset, offset += 64)}`;
    const arg3 = `0x${data.substring(offset, offset += 64)}`;
    const address = target;

    msgSender = '0x' + toStr(msgSender, 64);
    target = '0x' + toStr(target, 64);

    if (this.__proto__.hasOwnProperty(funcSig)) {
      const [ret, logs] = this[funcSig](msgSender, target, arg1, arg2, arg3);
      const logsLength = logs.length;

      for (let i = 0; i < logsLength; i++) {
        logs[i].address = address;
      }

      return [ret, logs];
    }

    return [undefined, []];
  }
};
