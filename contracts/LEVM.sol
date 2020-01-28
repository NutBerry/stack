pragma solidity ^0.5.2;

import './Inventory.sol';

contract LEVM is Inventory {
  // needs to be replaced with the deployed address
  address constant GATED_COMPUTING_ADDRESS = 0xabCDeF0123456789AbcdEf0123456789aBCDEF01;

  bytes4 constant internal FUNC_SIG_BALANCE_OF = hex'70a08231';
  bytes4 constant internal FUNC_SIG_APPROVE = hex'095ea7b3';
  bytes4 constant internal FUNC_SIG_ALLOWANCE = hex'dd62ed3e';
  bytes4 constant internal FUNC_SIG_TRANSFER = hex'a9059cbb';
  bytes4 constant internal FUNC_SIG_TRANSFER_FROM = hex'23b872dd';

  /// @dev Internal helper for parsing encoded transactions from calldata.
  function _parseTx (
    uint256 offset,
    uint256 boundary,
    uint256[5] memory params
  ) internal returns (uint256) {
    if (offset >= boundary) {
      return offset;
    }

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

      // reserve 3 bytes for final transaction length encoding
      let memPtr := add(mload(0x40), 3)

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
      calldatacopy(add(memPtr, 64), offset, 64)
      offset := add(offset, 64)
      // v
      mstore(add(memPtr, 32), byte(0, calldataload(offset)))
      offset := add(offset, 1)
      // ecrecover
      let success := staticcall(gas(), 0x1, memPtr, 128, 0, 32)
      if iszero(success) {
        mstore(0, 0)
      }
      let from := mload(0)
      mstore(params, from)
    }

    return offset;
  }

  function _memLoad (uint256 offset) internal pure returns (uint256 ret) {
    assembly {
      ret := calldataload(offset)
    }
  }

  // solhint-disable-next-line function-max-lines
  function _handleCall (
    address caller,
    address target,
    uint inOffset,
    uint /*inSize*/
  ) internal returns (bool) {
    // TODO: do real checks
    // check inSize/inOffset bounds
    bytes4 functionSig = bytes4(bytes32(_memLoad(inOffset)));

    if (functionSig == FUNC_SIG_APPROVE) {
      address spender = address(uint160(_memLoad(inOffset + 4)));
      uint value = _memLoad(inOffset + 4 + 32);

      setAllowance(target, caller, spender, value);

      return true;
    }

    if (functionSig == FUNC_SIG_TRANSFER) {
      address to = address(uint160(_memLoad(inOffset + 4)));
      uint value = _memLoad(inOffset + 4 + 32);

      return _transfer(caller, target, to, value);
    }

    if (functionSig == FUNC_SIG_TRANSFER_FROM) {
      address from = address(uint160(_memLoad(inOffset + 4)));
      address to = address(uint160(_memLoad(inOffset + 4 + 32 )));
      uint256 tokenId = uint256(_memLoad(inOffset + 4 + 32 + 32));

      return _transferFrom(caller, target, from, to, tokenId);
    }

    // invalid - call fails
    return false;
  }

  /// @dev ERC20 transfer function, used by GatedComputing.
  function transfer (address to, uint256 value) public returns (bool) {
    address _caller;
    address target;
    assembly {
      _caller := sload(0xaa)
      target := sload(0xbb)
    }
    return _transfer(_caller, target, to, value);
  }

  /// @dev ERC20 transferFrom function, used by GatedComputing.
  function transferFrom (address from, address to, uint256 value) public returns (bool) {
    address _caller;
    address target;
    assembly {
      _caller := sload(0xaa)
      target := sload(0xbb)
    }
    return _transferFrom(_caller, target, from, to, value);
  }

  /// @dev ERC20 balanceOf function, used by GatedComputing.
  function balanceOf (address owner) public view returns (uint256) {
    address target;
    assembly {
      target := sload(0xbb)
    }
    return _balanceOf(target, owner);
  }

  /// @dev ERC20 allowance function, used by GatedComputing.
  function allowance (address owner, address spender) public view returns (uint256) {
    address target;
    assembly {
      target := sload(0xbb)
    }
    return _allowance(target, owner, spender);
  }

  /// @dev Deploy a patched version of `target` and call the contract with `callData`.
  function _deployAndCall (address gated, address target, bytes memory callData) internal returns (bool) {
    bool success;

    assembly {
      let memPtr := mload(0x40)
      let codeSize := extcodesize(target)

      extcodecopy(target, memPtr, 0, codeSize)

      // TODO
      // deployment limit 4mil gas
      success := call(gas(), gated, 0, memPtr, codeSize, 12,  20)
      if eq(success, 1) {
        let patchedAddress := mload(0)
        // TODO
        // 2 mil execution limit?
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

  /// @dev Internal function for executing(replay) transactions.
  function _validateBlock (uint256 offset) internal returns (bool, uint256) {
    // a deposit-block
    if (_isSpecialBlock()) {
      // TODO: check for overflow?
      address token;
      address owner;
      uint256 value;
      assembly {
        owner := shr(96, calldataload(4))
        token := shr(96, calldataload(24))
        value := calldataload(44)
      }
      uint256 newValue = getERC20(token, owner);
      newValue += value;
      setERC20(token, owner, newValue);

      return (true, 0);
    }

    uint256[5] memory params;
    uint256 length;
    assembly {
      length := calldatasize()
    }

    if (length < 65) {
      return (true, 0);
    }

    if (offset >= length) {
      return (true, 0);
    }

    offset = _parseTx(offset, length, params);

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
    if (nonce != getNonce(from)) {
      return (offset >= length, offset);
    }
    setNonce(from, nonce + 1);

    bytes4 funcSig;
    assembly {
      funcSig := calldataload(calldataOffset)
    }
    if (
      funcSig == FUNC_SIG_BALANCE_OF ||
      funcSig == FUNC_SIG_APPROVE ||
      funcSig == FUNC_SIG_ALLOWANCE ||
      funcSig == FUNC_SIG_TRANSFER ||
      funcSig == FUNC_SIG_TRANSFER_FROM
    ) {
      _handleCall(from, to, calldataOffset, calldataLength);
    } else {
      bytes memory c = new bytes(calldataLength);
      assembly {
        calldatacopy(add(c, 32), calldataOffset, calldataLength)
        // store our address to be used by the patched contract
        // TO
        sstore(0xaa, to)
        // FROM
        sstore(0xcc, from)
      }
      // state is reverted if the contract reverts
      _deployAndCall(GATED_COMPUTING_ADDRESS, to, c);
      assembly {
        // reset slots
        sstore(0xaa, 0)
        sstore(0xbb, 0)
        sstore(0xcc, 0)
      }
    }

    return (offset >= length, offset);
  }
}
