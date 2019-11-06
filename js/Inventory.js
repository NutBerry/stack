'use strict';

const ethers = require('ethers');

const UINT256_ZERO = ''.padStart(128, '0');
const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_POW_2_32 = BigInt(4294967296);
const UINT_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
const UINT_ONE = '0x0000000000000000000000000000000000000000000000000000000000000001';

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
/// ERC1948
///   - readData (tokenId)
///   - writeData (tokenId, newTokenData)
///
/// ERC1949(not done):
///   - breed (tokenId, to, newTokenData)
///
/// ERC20, ERC721, ERC1948, ERC1949
///   - transferFrom (from, to, tokenId)
module.exports = class Inventory {
  static fromJSON (obj) {
    const ret = new this();
    const len = obj.bag.length;

    for (let i = 0; i < len; i++) {
      ret.addToken(obj.bag[i]);
    }
    ret.allowances = obj.allowances;

    return ret;
  }

  constructor () {
    this.tokenBag = {};
    this.allowances = {};
    this.storageKeys = {};
  }

  toJSON () {
    const bag = this._dumpBag(this.tokenBag);
    const allowances = Object.assign({}, this.allowances);

    return { bag, allowances };
  }

  _dumpBag (bag) {
    const ret = [];
    const tokens = Object.keys(bag);
    const len = tokens.length;

    for (let i = 0; i < len; i++) {
      const array = bag[tokens[i]];
      for (let k in array) {
        const e = array[k];
        ret.push(Object.assign({}, e));
      }
    }

    return ret;
  }

  _isApprovedOrOwner (msgSender, token) {
    return token.owner === msgSender || this.getApproved(msgSender, token.address, token.value);
  }

  clone () {
    const ret = this.toJSON();

    return this.constructor.fromJSON(ret);
  }

  _incrementExit (target, owner, value) {
    // TODO
    // increment
    let k = ethers.utils.keccak256(
      Buffer.from(
        '00000001' + owner.replace('0x', '') + target.replace('0x', ''),
        'hex'
      )
    );

    value = `0x${value.toString(16).padStart(64, '0')}`;
    this.storageKeys[k] = value;
  }

  trackNonce (target, value) {
    const k = '0x' + target.replace('0x', '').padStart(64, '0');
    this.storageKeys[k] = '0x' + value.toString(16).padStart(64, '0');
  }

  _hashERC20 (target, owner, value) {
    const k = ethers.utils.keccak256(
      Buffer.from(
        '00000002' + target.replace('0x', '') + owner.replace('0x', ''),
        'hex'
      )
    );
    this.storageKeys[k] = value;
  }

  _hashAllowance (target, owner, spender, value) {
    const k = ethers.utils.keccak256(
      Buffer.from(
        '00000003' + target.replace('0x', '') + owner.replace('0x', '') + spender.replace('0x', ''),
        'hex'
      )
    );
    this.storageKeys[k] = value;
  }

  addToken (e) {
    // index by owner for ERC20,
    // else index by value (tokenId)
    const t = {
      address: e.address.toLowerCase(),
      owner: e.owner.toLowerCase(),
      value: e.value || UINT_ZERO,
      data: e.data || UINT_ZERO,
      isERC20: e.isERC20 || false,
      isERC721: e.isERC721 || false,
      isERC1948: e.isERC1948 || false,
      isERC1949: e.isERC1949 || false,
    };

    let bag = this.tokenBag[t.address];

    if (!bag) {
      bag = {};
      this.tokenBag[t.address] = bag;
    }

    if (t.isERC20) {
      let ex = bag[t.owner];
      if (ex) {
        let oldValue = BigInt(ex.value);
        let newValue = oldValue + BigInt(t.value);
        ex.value = `0x${newValue.toString(16).padStart(64, '0')}`;
      } else {
        bag[t.owner] = t;
      }
    } else {
      bag[t.value] = t;
    }
  }

  getERC20 (target, owner) {
    const bag = this.tokenBag[target];

    if (bag) {
      const e = bag[owner];

      if (e && e.isERC20) {
        return e;
      }
    }

    return null;
  }

  getERC721 (target, tokenId) {
    const bag = this.tokenBag[target];

    if (bag) {
      const e = bag[tokenId];

      if (e && !e.isERC20) {
        return e;
      }
    }

    return null;
  }

  getAllowance (target, owner, spender) {
    const allowance = this.allowances[target + owner + spender];
    return allowance || UINT256_ZERO;
  }

  setAllowance (target, owner, spender, value) {
    // TODO
    this.allowances[target + owner + spender] = value;
    this._hashAllowance(target, owner, spender, value);
    return '0000000000000000000000000000000000000000000000000000000000000001';
  }

  addAllowance (target, owner, spender, value) {
    target = target.toLowerCase();
    owner = owner.toLowerCase();
    spender = spender.toLowerCase();

    let tmp = this.getAllowance(target, owner, spender);
    let old = BigInt(tmp || '0');
    let newVal = old + BigInt(value);
    tmp = `0x${newVal.toString(16).padStart(64, '0')}`;

    this.allowances[target + owner + spender] = tmp;
  }

  /// @notice ERC20 only.
  /// @dev Assumes `target` exist in the token bag.
  balanceOf (target, owner) {
    const e = this.getERC20(target, owner);

    if (e) {
      return e.value;
    }

    return UINT_ZERO;
  }

  /// @notice ERC20 only.
  /// @dev Assumes `target` exist in the token bag.
  allowance (target, owner, spender) {
    const e = this.getERC20(target, owner);
    const allowance = this.getAllowance(target, owner, spender);

    if (e && allowance) {
      return allowance;
    }

    return UINT256_ZERO;
  }

  /// @notice ERC721, ERC1948, ERC1949  only.
  /// @dev Assumes `target` exist in the token bag.
  ownerOf (target, tokenId) {
    const e = this.getERC721(target, tokenId);

    if (e) {
      return e.owner.replace('0x', '').padStart(64, '0');
    }
  }

  /// @notice ERC721, ERC1948, ERC1949  only.
  /// @dev Assumes `target` exist in the token bag.
  getApproved (msgSender, target, tokenId) {
    const e = this.getERC721(target, tokenId);

    if (e) {
      if (this.getAllowance(target, e.owner, msgSender)) {
        return msgSender.replace('0x', '').padStart(64, '0');
      }

      return UINT256_ZERO;
    }
  }

  /// @notice ERC20 only.
  /// @dev Assumes `target` exist in the token bag.
  /// TODO: check for ZERO address?
  transfer (msgSender, target, to, value) {
    const e = this.getERC20(target, msgSender);

    if (e) {
      const targetEntry = this.getERC20(target, to);
      const want = BigInt(value);
      const has = BigInt(e.value);

      if (want === BIGINT_ZERO) {
        return;
      }

      if (has >= want) {
        e.value = `0x${(has - want).toString(16).padStart(64, '0')}`;
        this._hashERC20(target, msgSender, e.value);

        if (to === this._bridgeAddr) {
          this._incrementExit(target, msgSender, want);
        } else {
          // TODO: hash exits
          if (!targetEntry) {
            const newEntry = {
              address: target,
              owner: to,
              value: value,
              data: '0x0000000000000000000000000000000000000000000000000000000000000000',
              isERC20: true,
            };
            this.addToken(newEntry);
            this._hashERC20(target, to, newEntry.value);
          } else {
            targetEntry.value = `0x${(BigInt(targetEntry.value) + want).toString(16).padStart(64, '0')}`;
            this._hashERC20(target, to, targetEntry.value);
          }
        }

        return '0000000000000000000000000000000000000000000000000000000000000001';
      }
    }
  }

  /// @notice ERC20, ERC721, ERC1948, ERC1949 only.
  /// @dev Assumes `target` exist in the token bag.
  /// TODO: check for ZERO address?
  transferFrom (msgSender, target, from, to, tokenId) {
    let e = this.getERC20(target, from);

    if (e) {
      const has = BigInt(e.value);
      const want = BigInt(tokenId);
      const allowance = BigInt(this.getAllowance(target, from, msgSender) || '0');

      // not enough
      if (has < want || (want > allowance && e.owner !== msgSender) || want === BIGINT_ZERO) {
        return;
      }
      if (e.owner !== msgSender) {
        this.allowances[target + from + msgSender] = `0x${(allowance - want).toString(16).padStart(64, '0')}`;
        this._hashAllowance(target, from, msgSender, `0x${(allowance - want).toString(16).padStart(64, '0')}`);
      }
      e.value = `0x${(has - want).toString(16).padStart(64, '0')}`;
      this._hashERC20(target, from, e.value);

      // now update `to`
      if (to === this._bridgeAddr) {
        this._incrementExit(target, from, want);
      } else {
        const oldEntry = this.getERC20(target, to);
        if (oldEntry) {
          const val = BigInt(oldEntry.value) + BigInt(tokenId);
          oldEntry.value = `0x${val.toString(16).padStart(64, '0')}`;
          this._hashERC20(target, to, oldEntry.value);
        } else {
          const newEntry = {
            address: target,
            owner: to,
            value: tokenId,
            isERC20: true,
            data: '0x0000000000000000000000000000000000000000000000000000000000000000',
          };
          this._hashERC20(target, to, newEntry.value);
          this.addToken(newEntry);
        }
      }
      return '0000000000000000000000000000000000000000000000000000000000000001';
    } else {
      const e = this.getERC721(target, tokenId);

      if (e && this._isApprovedOrOwner(msgSender, e)) {
        delete this.allowances[target + e.owner + msgSender];
        e.owner = to;
        return '0000000000000000000000000000000000000000000000000000000000000001';
      }
    }
  }

  /// @notice ERC1948, ERC1949 only.
  /// @dev Assumes `target` exist in the token bag.
  readData (target, tokenId) {
    const e = this.getERC721(target, tokenId);

    if (e && (e.isERC1948 || e.isERC1949)) {
      return e.data;
    }
  }

  /// @notice ERC1948, ERC1949 only.
  /// @dev Assumes `target` exist in the token bag.
  writeData (msgSender, target, tokenId, newTokenData) {
    const e = this.getERC721(target, tokenId);

    if (e && (e.isERC1948 || e.isERC1949) && this._isApprovedOrOwner(msgSender, e)) {
      e.data = newTokenData;
      return '0000000000000000000000000000000000000000000000000000000000000001';
    }
  }

  /// @notice ERC1949 only.
  /// @dev Assumes `target` exist in the token bag.
  breed (msgSender, target, tokenId, to, newTokenData) {
    const e = this.getERC721(target, tokenId);

    // TODO "sender not queen owner nor approved"
    // TODO: How do we signal that the token is a Queen?...
    if (e && e.isERC1949 && this._isApprovedOrOwner(msgSender, e)) {
      // uint256 counter = uint256(readData(_queenId));
      const counter = BigInt(e.data);
      // require(counter > 0, "queenId too low");
      // require(counter < 4294967296, "queenId too high");  // 2 ^ 32 = 4294967296
      if (counter < BIGINT_ZERO || counter > BIGINT_POW_2_32) {
        return;
      }
      // writeData(_queenId, bytes32(counter + 1));
      e.data = `0x${(counter + BIGINT_ONE).toString(16).padStart(64, '0')}`;
      // uint256 newId = uint256(keccak256(abi.encodePacked(_queenId, counter)));
      const newId = ethers.utils.solidityKeccak256(['uint256', 'bytes32'], [target, e.data]);
      // mint
      const newEntry = {
        address: target,
        owner: to,
        value: newId,
        data: newTokenData,
        isERC1949: true,
      };
      this.addToken(newEntry);
      // returns nothing
      return '';
    }
  }
};
