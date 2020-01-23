'use strict';

const ethers = require('ethers');

const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_POW_2_32 = BigInt(4294967296);
const UINT_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
const UINT_ONE = '0x0000000000000000000000000000000000000000000000000000000000000001';
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

const FUNC_SIG_BALANCE_OF = '70a08231';
const FUNC_SIG_APPROVE = '095ea7b3';
const FUNC_SIG_ALLOWANCE = 'dd62ed3e';
const FUNC_SIG_TRANSFER = 'a9059cbb';
const FUNC_SIG_TRANSFER_FROM = '23b872dd';
const FUNC_SIG_OWNER_OF = '6352211e';
const FUNC_SIG_GET_APPROVED = '081812fc';
const FUNC_SIG_READ_DATA = '37ebbc03';
const FUNC_SIG_WRITE_DATA = 'a983d43f';
const FUNC_SIG_BREED = '451da9f9';

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
    ret.storageKeys = obj.storageKeys;

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
    const storageKeys = Object.assign({}, this.storageKeys);

    return { bag, allowances, storageKeys };
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
    return allowance || UINT_ZERO;
  }

  setAllowance (target, owner, spender, value) {
    // TODO
    this.allowances[target + owner + spender] = value;
    this._hashAllowance(target, owner, spender, value);
    return UINT_ONE;
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

    return UINT_ZERO;
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

      return UINT_ZERO;
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

        if (to === ADDRESS_ZERO) {
          this._incrementExit(target, msgSender, want);
        } else {
          // TODO: hash exits
          if (!targetEntry) {
            const newEntry = {
              address: target,
              owner: to,
              value: value,
              data: UINT_ZERO,
              isERC20: true,
            };
            this.addToken(newEntry);
            this._hashERC20(target, to, newEntry.value);
          } else {
            targetEntry.value = `0x${(BigInt(targetEntry.value) + want).toString(16).padStart(64, '0')}`;
            this._hashERC20(target, to, targetEntry.value);
          }
        }

        return UINT_ONE;
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
          data: UINT_ZERO,
        };
        this._hashERC20(target, to, newEntry.value);
        this.addToken(newEntry);
      }
      return UINT_ONE;
    } else {
      const e = this.getERC721(target, tokenId);

      if (e && this._isApprovedOrOwner(msgSender, e)) {
        delete this.allowances[target + e.owner + msgSender];
        e.owner = to;
        return UINT_ONE;
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
      return UINT_ONE;
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

  // `_to` = contract address
  handleCall (msgSender, _to, target, data) {
    let offset = 0;
    let inventory = this;
    const funcSig = data.substring(offset, offset += 8);

    if (funcSig === FUNC_SIG_BALANCE_OF) {
      const owner = `0x${data.substring(offset += 24, offset += 40)}`;

      return [inventory.balanceOf(target, owner), []];
    }

    // TODO
    // ERC721
    // event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    // event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);

    if (funcSig === FUNC_SIG_ALLOWANCE) {
      const owner = '0x' + data.substring(offset += 24, offset += 40);
      const spender = '0x' + data.substring(offset += 24, offset += 40);

      return [inventory.allowance(target, owner, spender), []];
    }

    if (funcSig === FUNC_SIG_APPROVE) {
      // TODO
      const spender = '0x' + data.substring(offset += 24, offset += 40);
      const value = '0x' + data.substring(offset, offset += 64);

      const ret = inventory.setAllowance(target, msgSender, spender, value);
      if (ret === UINT_ONE) {
        // 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925
        // event Approval(address indexed, address indexed, uint256);
        const logs = [
          {
            address: target,
            topics: [
              '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
              '0x' + msgSender.replace('0x', '').padStart(64, '0'),
              '0x' + spender.replace('0x', '').padStart(64, '0'),
            ],
            data: value,
          },
        ];

        return [ret, logs];
      }

      return [ret, []];
    }

    if (funcSig === FUNC_SIG_TRANSFER) {
      const to = '0x' + data.substring(offset += 24, offset += 40);
      const value = '0x' + data.substring(offset, offset += 64);

      const ret = inventory.transfer(msgSender, target, to, value);

      if (ret === UINT_ONE) {
        const logs = [
          {
            address: target,
            topics: [
              '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
              '0x' + msgSender.replace('0x', '').padStart(64, '0'),
              '0x' + to.replace('0x', '').padStart(64, '0'),
            ],
            data: value,
          },
        ];
        return [ret, logs];
      }

      return [ret, []];
    }

    if (funcSig === FUNC_SIG_TRANSFER_FROM) {
      const from = '0x' + data.substring(offset += 24, offset += 40);
      const to = '0x' + data.substring(offset += 24, offset += 40);
      const tokenId = '0x' + data.substring(offset, offset += 64);

      return [inventory.transferFrom(msgSender, target, from, to, tokenId), []];
    }

    if (this.testing) {
      if (funcSig === FUNC_SIG_OWNER_OF) {
        const tokenId = '0x' + data.substring(offset, offset += 64);

        return [inventory.ownerOf(target, tokenId), []];
      }

      if (funcSig === FUNC_SIG_GET_APPROVED) {
        const tokenId = '0x' + data.substring(offset, offset += 64);

        return [inventory.getApproved(_to, target, tokenId), []];
      }

      if (funcSig === FUNC_SIG_READ_DATA) {
        const tokenId = '0x' + data.substring(offset, offset += 64);

        return [inventory.readData(target, tokenId), []];
      }

      if (funcSig === FUNC_SIG_WRITE_DATA) {
        const tokenId = '0x' + data.substring(offset, offset += 64);
        const newTokenData = '0x' + data.substring(offset, offset += 64);

        return [inventory.writeData(msgSender, target, tokenId, newTokenData), []];
      }

      if (funcSig === FUNC_SIG_BREED) {
        const tokenId = '0x' + data.substring(offset, offset += 64);
        const to = '0x' + data.substring(offset += 24, offset += 40);
        const newTokenData = '0x' + data.substring(offset, offset += 64);

        return [inventory.breed(msgSender, target, tokenId, to, newTokenData), []];
      }
    }
  }
};
