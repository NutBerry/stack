pragma solidity ^0.6.2;

import './Inventory.sol';

contract LEVM is Inventory {
  // needs to be replaced with the deployed address
  address constant GATED_COMPUTING_ADDRESS = 0xabCDeF0123456789AbcdEf0123456789aBCDEF01;

  // note, we only use the last 3 bytes instead of 4
  // the cut the first byte of the function sig
  // because that's used as a overwrite-byte in
  // GatedComputing
  uint256 constant internal FUNC_SIG_BALANCE_OF = 0xa08231;
  uint256 constant internal FUNC_SIG_APPROVE = 0x5ea7b3;
  uint256 constant internal FUNC_SIG_ALLOWANCE = 0x62ed3e;
  uint256 constant internal FUNC_SIG_TRANSFER = 0x059cbb;
  uint256 constant internal FUNC_SIG_TRANSFER_FROM = 0xb872dd;
  uint256 constant internal FUNC_SIG_OWNER_OF = 0x52211e;
  uint256 constant internal FUNC_SIG_GET_APPROVED = 0x1812fc;

  function _loadFrom () internal returns (address v) {
    assembly {
      v := sload(0xf0)
    }
  }

  function _loadTo () internal returns (address v) {
    assembly {
      v := sload(0xf2)
    }
  }

  function _arg1 () internal returns (uint256 v) {
    assembly {
      v := calldataload(4)
    }
  }

  function _arg2 () internal returns (uint256 v) {
    assembly {
      v := calldataload(36)
    }
  }

  function _arg3 () internal returns (uint256 v) {
    assembly {
      v := calldataload(68)
    }
  }

  function _returnValue (uint256 v) internal {
    assembly {
      mstore(0, v)
      return(0, 32)
    }
  }

  function _revertOnFailure (uint256 v) internal {
    assembly {
      mstore(0, v)
      if iszero(v) {
        revert(0, 32)
      }
      return(0, 32)
    }
  }

  fallback () external {
    uint256 functionSig;
    assembly {
      functionSig := shr(224, calldataload(0))
    }

    if (functionSig == FUNC_SIG_BALANCE_OF) {
      _returnValue(_balanceOf(_loadTo(), address(_arg1())));
    }

    if (functionSig == FUNC_SIG_ALLOWANCE) {
      _returnValue(_allowance(_loadTo(), address(_arg1()), address(_arg2())));
    }

    if (functionSig == FUNC_SIG_OWNER_OF) {
      _returnValue(_getStorage(_hashERC721(_loadTo(), _arg1())));
    }

    if (functionSig == FUNC_SIG_GET_APPROVED) {
      _returnValue(_getStorage(_hashApproval(_loadTo(), _arg1())));
    }

    if (functionSig == FUNC_SIG_APPROVE) {
      _revertOnFailure(_approve(_loadFrom(), _loadTo(), address(_arg1()), _arg2()));
    }

    if (functionSig == FUNC_SIG_TRANSFER) {
      _revertOnFailure(_transfer(_loadFrom(), _loadTo(), address(_arg1()), _arg2()));
    }

    if (functionSig == FUNC_SIG_TRANSFER_FROM) {
      _revertOnFailure(_transferFrom(_loadFrom(), _loadTo(), address(_arg1()), address(_arg2()), _arg3()));
    }

    assembly {
      revert(0, 0)
    }
  }

  /// @dev Internal helper for parsing encoded transactions from calldata.
  function _parseTransaction (
    uint256 offset,
    uint256[5] memory params
  ) internal returns (uint256) {
    assembly {
      function encodeRLP (valuePtr, byteLength, memPtr) -> res {
        // encode data
        if iszero(byteLength) {
          mstore8(memPtr, 0x80)
          memPtr := add(memPtr, 1)
          res := 1
        }

        let callDataByte := byte(0, calldataload(valuePtr))
        if and( eq(byteLength, 1), lt(callDataByte, 0x80) ) {
          mstore8(memPtr, callDataByte)
          memPtr := add(memPtr, 1)
          res := 1
        }
        // else
        if and( iszero(res), lt(byteLength, 56) ) {
          mstore8(memPtr, add(0x80, byteLength))
          memPtr := add(memPtr, 1)
          calldatacopy(memPtr, valuePtr, byteLength)
          memPtr := add(memPtr, byteLength)
        }
        // else
        if gt(byteLength, 55) {
          let length := 1
          if gt(byteLength, 0xff) {
            length := 2
          }

          mstore8(memPtr, add(0xb7, length))
          memPtr := add(memPtr, 1)
          memPtr := add(memPtr, length)

          let _v := byteLength
          for { let l := 0 } lt(l, length) { l := add(l, 1) } {
            mstore8(sub(memPtr, add(l, 1)), _v)
            _v := shr(8, _v)
          }

          calldatacopy(memPtr, valuePtr, byteLength)
          memPtr := add(memPtr, byteLength)
        }

        res := memPtr
      }

      function decodeSimple (o, params) -> offset {
        offset := o

        // nonce
        {
          let nonce := byte(0, calldataload(offset))
          offset := add(offset, 1)

          if gt(nonce, 0xde) {
            let shiftBytes := sub(0xff, nonce)
            nonce := calldataload(offset)
            offset := add(offset, shiftBytes)
            shiftBytes := sub(32, shiftBytes)
            nonce := shr(mul(shiftBytes, 8), nonce)
          }
          mstore(add(params, 64), nonce)
        }

        // to
        {
          let to := shr(96, calldataload(offset))
          mstore(add(params, 32), to)
          offset := add(offset, 20)
        }

        // callData
        {
          let callDataSize := byte(0, calldataload(offset))
          let callDataOffset := add(offset, 1)

          if eq(callDataSize, 0xff) {
            offset := add(offset, 1)
            callDataSize := shr(240, calldataload(offset))
            callDataOffset := add(offset, 2)
            offset := add(callDataOffset, callDataSize)
          }

          if lt(callDataSize, 0xff) {
            offset := add(callDataOffset, callDataSize)
          }

          mstore(add(params, 96), callDataOffset)
          mstore(add(params, 128), callDataSize)
        }
      }

      function decodeAndEncode (o, m, params) -> offset, memPtr {
        offset := o
        memPtr := m

        // nonce
        {
          let nonce := byte(0, calldataload(offset))
          let NONCE_OFFSET := offset
          offset := add(offset, 1)
          let nonceSize := 0

          if gt(nonce, 0) {
            nonceSize := 1
          }

          if gt(nonce, 0xde) {
            let shiftBytes := sub(0xff, nonce)
            nonceSize := shiftBytes
            NONCE_OFFSET := offset
            nonce := calldataload(offset)
            offset := add(offset, shiftBytes)
            shiftBytes := sub(32, shiftBytes)
            nonce := shr(mul(shiftBytes, 8), nonce)
          }
          mstore(add(params, 64), nonce)

          // encode nonce
          memPtr := encodeRLP(NONCE_OFFSET, nonceSize, memPtr)
        }

        // to
        {
          // gasPrice = 0
          mstore8(memPtr, 0x80)
          memPtr := add(memPtr, 1)
          // gasLimit = 0
          mstore8(memPtr, 0x80)
          memPtr := add(memPtr, 1)
          {
            // to - 20 bytes
            mstore8(memPtr, 0x94)
            memPtr := add(memPtr, 1)

            let to := shr(96, calldataload(offset))
            mstore(memPtr, shl(96, to))
            mstore(add(params, 32), to)
            offset := add(offset, 20)

            memPtr := add(memPtr, 20)
          }
          // value
          mstore8(memPtr, 0x80)
          memPtr := add(memPtr, 1)
        }

        // callData
        {
          let callDataSize := byte(0, calldataload(offset))
          let callDataOffset := add(offset, 1)

          if eq(callDataSize, 0xff) {
            offset := add(offset, 1)
            callDataSize := shr(240, calldataload(offset))
            callDataOffset := add(offset, 2)
            offset := add(callDataOffset, callDataSize)
          }

          if lt(callDataSize, 0xff) {
            offset := add(callDataOffset, callDataSize)
          }

          mstore(add(params, 96), callDataOffset)
          mstore(add(params, 128), callDataSize)

          memPtr := encodeRLP(callDataOffset, callDataSize, memPtr)
        }
      }

      // signature
      let v := byte(0, calldataload(offset))
      offset := add(offset, 1)
      let r := calldataload(offset)
      offset := add(offset, 32)
      let s := calldataload(offset)
      offset := add(offset, 32)

      let is712 := or( eq(v, 0x80), eq(v, 0x81) )

      switch is712
      // EIP-712
      case 1 {
        let memPtr := mload(0x40)

        offset := decodeSimple(offset, params)

        // calldatasize
        let tmp := mload(add(params, 128))
        // copy calldata
        calldatacopy(memPtr, mload(add(params, 96)), tmp)
        //calldatahash
        mstore(add(memPtr, 96), keccak256(memPtr, tmp))
        // typehash
        mstore(memPtr, 0x174ead53e7b62242b648b7bb2a954244aaa3af2f55517ec670f9801d2dea09e5)
        // to
        mstore(add(memPtr, 32), mload(add(params, 32)))
        // nonce
        mstore(add(memPtr, 64), mload(add(params, 64)))
        // transactionStructHash
        tmp := keccak256(memPtr, 128)
        // prefix
        mstore(memPtr, 0x1901000000000000000000000000000000000000000000000000000000000000)
        // DOMAIN struct hash
        mstore(add(memPtr, 2), 0x0f74ffb7207f25d4ae678c8841affcefd13e0c34b475ef7dd5773791690ba137)
        // transactionStructHash
        mstore(add(memPtr, 34), tmp)
        // digest
        mstore(memPtr, keccak256(memPtr, 66))
        // v - 101
        mstore(add(memPtr, 32), sub(v, 101))
        // r
        mstore(add(memPtr, 64), r)
        // s
        mstore(add(memPtr, 96), s)
        // ecrecover
        mstore(params, 0)
        let success := staticcall(gas(), 0x1, memPtr, 128, params, 32)
      }
      // assume RLP
      default {
        // reserve 3 bytes for final transaction length encoding
        let memPtr := add(mload(0x40), 3)

        offset, memPtr := decodeAndEncode(offset, memPtr, params)

        let payloadLength := sub( sub(memPtr, mload(0x40) ), 3)

        if gt(payloadLength, 55) {
          let length := 1
          if gt(payloadLength, 0xff) {
            length := 2
          }

          memPtr := sub( add(mload(0x40), 3), add(length, 1))
          let backup := memPtr
          mstore8(memPtr, add(0xf7, length))
          memPtr := add(memPtr, 1)
          memPtr := add(memPtr, length)

          let _v := payloadLength
          for { let l := 0 } lt(l, length) { l := add(l, 1) } {
            mstore8(sub(memPtr, add(l, 1)), _v)
            _v := shr(8, _v)
          }

          memPtr := backup
          payloadLength := add(payloadLength, add(length, 1))
        }

        if lt(payloadLength, 56) {
          memPtr := add(mload(0x40), 2)
          mstore8(memPtr, add(0xc0, payloadLength))
          payloadLength := add(payloadLength, 1)
        }

        // digest
        mstore(memPtr, keccak256(memPtr, payloadLength))
        // signature
        mstore(add(memPtr, 64), r)
        mstore(add(memPtr, 96), s)
        // v
        mstore(add(memPtr, 32), v)
        // ecrecover
        mstore(params, 0)
        let success := staticcall(gas(), 0x1, memPtr, 128, params, 32)
      }
    }

    return offset;
  }

  function _memLoad (uint256 offset) internal pure returns (uint256 ret) {
    assembly {
      ret := calldataload(offset)
    }
  }

  function _checkGasLimit () internal {
    assembly {
      let limit := div(mul(gaslimit(), 10), 12)

      if lt(gas(), limit) {
        revert(0, 0)
      }
    }
  }

  /// @dev Deploy a patched version of `target` and call the contract with `callData`.
  function _deployAndCall (address gated, address target, bytes memory callData) internal returns (bool) {
    _checkGasLimit();

    bool success;

    assembly {
      let memPtr := mload(0x40)
      let codeSize := extcodesize(target)

      extcodecopy(target, memPtr, 0, codeSize)

      success := call(gas(), gated, 0, memPtr, codeSize, 12,  20)
      if eq(success, 1) {
        let patchedAddress := mload(0)
        // call the patched contract
        success := callcode(gas(), patchedAddress, 0, add(callData, 32), mload(callData), 0,  0)
      }
    }

    return success;
  }

  /// @dev Internal function that checks if calldata is a special block
  function _isSpecialBlock () internal returns (bool ret) {
    assembly {
      if eq(calldatasize(), 76) {
        ret := 1
      }
    }
  }

  function isERC721 (address token, uint256 tokenId) public view returns (bool ok) {
    assembly {
      // ownerOf
      let sig := shl(224, 0x6352211e)
      mstore(0x80, sig)
      mstore(0x84, tokenId)
      mstore(0, 0)
      let success := staticcall(100000, token, 0x80, 36, 0, 32)
      if eq(success, 1) {
        if gt(mload(0), 1) {
          ok := 1
        }
      }
    }
  }

  /// @dev Internal function for executing(replay) transactions.
  function _validateBlock (uint256 offset) internal returns (bool, uint256) {
    // a deposit-block
    if (_isSpecialBlock()) {
      address token;
      address owner;
      uint256 value;
      assembly {
        owner := shr(96, calldataload(4))
        token := shr(96, calldataload(24))
        value := calldataload(44)
      }

      if (isERC721(token, value)) {
        _setStorage(_hashERC721(token, value), uint256(owner));
      } else {
        // Do not care if `newValue` wraps around (malicious ERC20).
        bytes32 receiverKey = _hashERC20(token, owner);
        uint256 newValue = _getStorage(receiverKey) + value;
        _setStorage(receiverKey, newValue);
      }

      return (true, 0);
    }

    uint256[5] memory params;
    uint256 length;
    assembly {
      length := calldatasize()
    }

    if (offset >= length) {
      return (true, 0);
    }

    offset = _parseTransaction(offset, params);

    address from = address(uint160(params[0]));

    if (from == address(0)) {
      // invalid sig
      return (offset >= length, offset);
    }

    address to = address(uint160(params[1]));
    uint256 nonce = params[2];
    uint256 calldataOffset = params[3];
    uint256 calldataLength = params[4];

    // skip if the transaction nonce is not the expected one.
    if (nonce != _getStorage(bytes32(uint256(from)))) {
      return (offset >= length, offset);
    }
    _setStorage(bytes32(uint256(from)), nonce + 1);

    assembly {
      // zero
      calldatacopy(params, calldatasize(), 128)
      // copy up to 100 bytes
      let len := calldataLength
      if gt(len, 100) {
        len := 100
      }
      calldatacopy(add(params, 28), calldataOffset, len)
    }

    uint256 functionSig = params[0] & 0xffffff;
    if (functionSig == FUNC_SIG_APPROVE) {
      address spender = address(uint160(params[1]));
      uint256 value = params[2];

      _approve(from, to, spender, value);

    } else if (functionSig == FUNC_SIG_TRANSFER) {
      address _to = address(uint160(params[1]));
      uint256 value = params[2];

      _transfer(from, to, _to, value);

    } else if (functionSig == FUNC_SIG_TRANSFER_FROM) {
      address _from = address(uint160(params[1]));
      address _to = address(uint160(params[2]));
      uint256 tokenId = params[3];

      _transferFrom(from, to, _from, _to, tokenId);

    } else if (
      functionSig == FUNC_SIG_BALANCE_OF ||
      functionSig == FUNC_SIG_ALLOWANCE ||
      functionSig == FUNC_SIG_OWNER_OF ||
      functionSig == FUNC_SIG_GET_APPROVED
    ) {
      // do nothing
    } else {
      bytes memory c = new bytes(calldataLength);
      assembly {
        calldatacopy(add(c, 32), calldataOffset, calldataLength)
        // store our address to be used by the patched contract
        // TO
        sstore(0xf0, to)
        // FROM
        sstore(0xf1, from)
      }
      // state is reverted if the contract reverts
      _deployAndCall(GATED_COMPUTING_ADDRESS, to, c);
      assembly {
        // reset slots
        sstore(0xf0, 0)
        sstore(0xf1, 0)
        sstore(0xf2, 0)
      }
    }

    return (offset >= length, offset);
  }
}
