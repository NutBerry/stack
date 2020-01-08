pragma solidity ^0.5.2;

import './Inventory.sol';

contract LEVM is Inventory {
  // needs to be replaced with the deployed address
  address constant DEFAULT_CONTRACT_ADDRESS = 0xabCDeF0123456789AbcdEf0123456789aBCDEF01;

  bytes4 constant internal FUNC_SIG_BALANCE_OF = hex'70a08231';
  bytes4 constant internal FUNC_SIG_APPROVE = hex'095ea7b3';
  bytes4 constant internal FUNC_SIG_ALLOWANCE = hex'dd62ed3e';
  bytes4 constant internal FUNC_SIG_TRANSFER = hex'a9059cbb';
  bytes4 constant internal FUNC_SIG_TRANSFER_FROM = hex'23b872dd';
  // bytes4 constant internal FUNC_SIG_OWNER_OF = hex'6352211e';
  // bytes4 constant internal FUNC_SIG_GET_APPROVED = hex'081812fc';
  // bytes4 constant internal FUNC_SIG_READ_DATA = hex'37ebbc03';
  // bytes4 constant internal FUNC_SIG_WRITE_DATA = hex'a983d43f';
  // bytes4 constant internal FUNC_SIG_BREED = hex'451da9f9';

  /// @dev Internal helper for parsing RLP encoded transactions from calldata.
  /// Reverts if the transaction is malformed
  /// TODO: try to skip a malformed transaction instead of revert()
  function parseTx (
    uint256 offset,
    uint256 boundary,
    uint256[5] memory params
  ) internal view returns (uint256) {
    if (offset >= boundary) {
      return offset;
    }

    assembly {
      function parseInt (offset, length, boundary) -> result {
        if lt(add(offset, length), boundary) {
          for { let i := 0 } lt(i, length) { i := add(i, 1) } {
            let v := calldataload(add(offset, i))
            v := byte(0, v)
            result := add(mul(result, 256), v)
          }
        }
      }

      for { let i := 0 } lt(i, 7) { i := add(i, 1) } {
        let lengthOfData := 0
        let lengthField := 1
        let val := byte(0, calldataload(offset))
        let ok := 0

        if gt(val, 0xf7) {
          let len := sub(val, 0xf7)
          lengthOfData := parseInt(add(offset, 1), len, boundary)

          if iszero(lengthOfData) {
            i := 0xf
          }

          lengthField := add(lengthField, len)

          ok := 1
        }

        if iszero(ok) {
          if gt(val, 0xbf) {
            let len := sub(val, 0xc0)
            lengthOfData := len

            ok := 1
          }
        }

        if iszero(ok) {
          if gt(val, 0xb7) {
            let len := sub(val, 0xb7)
            lengthOfData := parseInt(add(offset, 1), len, boundary)

            if iszero(lengthOfData) {
              i := 0xf
            }

            lengthField := add(lengthField, len)

            ok := 1
          }
        }

        if iszero(ok) {
          if gt(val, 0x7f) {
            let len := sub(val, 0x80)
            lengthOfData := len

            ok := 1
          }
        }

        if iszero(ok) {
          lengthOfData := 1
          lengthField := 0
        }

        if gt(add(offset, add(lengthField, lengthOfData)), boundary) {
          i := 0xf
        }

        // each transaction should have 6 fields
        // nonce
        // gasPrice
        // gasLimit
        // to
        // value
        // data

        if iszero(i) {
          let txlen := add(lengthOfData, lengthField)

          let ptr := mload(0x40)
          // dirty memory. We assume functions clear the memory slots before using them.
          calldatacopy(ptr, offset, txlen)
          let digest := keccak256(ptr, txlen)
          mstore(0, digest)
        }

        offset := add(offset, lengthField)

        if eq(i, 1) {
          let nonce := 0

          if gt(lengthOfData, 32) {
            //revert(0, 0)
          }

          if gt(lengthOfData, 0) {
            // nonce
            nonce := calldataload(offset)
            let shiftBytes := sub(32, lengthOfData)
            nonce := shr(mul(shiftBytes, 8), nonce)
          }

          // set nonce
          mstore(add(params, 64), nonce)
        }

        // 2 = gasPrice, 3 = gasLimit, 5 = value
        if or(eq(i, 2), or(eq(i, 3), eq(i, 5))) {
          if or(xor(lengthOfData, 0), xor(lengthField, 1)) {
            //revert(0, 0)
          }
        }

        if eq(i, 4) {
          if xor(lengthOfData, 20) {
            //revert(0, 0)
          }
          // to
          let to := calldataload(offset)
          to := shr(96, to)

          mstore(add(params,  32), to)
        }

        if eq(i, 6) {
          // callDataOffset
          mstore(add(params,  96), offset)
          // callDataLength
          mstore(add(params,  128), lengthOfData)
        }

        if gt(i, 0) {
          offset := add(offset, lengthOfData)
        }

        if eq(i, 0xf) {
          offset := 0
        }
      }

      if gt(offset, 0) {
        if gt(add(offset, 65), boundary) {
          // revert(0, 0)
        }

        let backup := mload(0x40)

        calldatacopy(0x40, offset, 64)
        offset := add(offset, 64)
        let v := calldataload(offset)
        v := byte(0, v)
        mstore(0x20, v)
        offset := add(offset, 1)

        // ecrecover
        let success := staticcall(gas(), 0x1, 0, 128, 0, 0x20)
        let from := mload(0)
        mstore(params, from)
        mstore(0x40, backup)
        mstore(0x60, 0)
      }
    }

    return offset;
  }

  function memLoad (uint256 offset) internal pure returns (uint256 ret) {
    assembly {
      ret := calldataload(offset)
    }
  }

  // solhint-disable-next-line function-max-lines
  function handleCall (
    address caller,
    address target,
    uint inOffset,
    uint /*inSize*/
  ) internal returns (bytes memory) {
    bytes4 functionSig = bytes4(bytes32(memLoad(inOffset)));

    // TODO: do real checks
    // check inSize/inOffset bounds
    // if FALSE return ''

    if (functionSig == FUNC_SIG_APPROVE) {
      address spender = address(uint160(memLoad(inOffset + 4)));
      uint value = memLoad(inOffset + 4 + 32);

      setAllowance(target, caller, spender, value);
      // TODO
      return abi.encodePacked(true);
    }

    if (functionSig == FUNC_SIG_TRANSFER) {
      address to = address(uint160(memLoad(inOffset + 4)));
      uint value = memLoad(inOffset + 4 + 32);

      return abi.encodePacked(_transfer(caller, target, to, value));
    }

    if (functionSig == FUNC_SIG_TRANSFER_FROM) {
      address from = address(uint160(memLoad(inOffset + 4)));
      address to = address(uint160(memLoad(inOffset + 4 + 32 )));
      uint256 tokenId = uint256(memLoad(inOffset + 4 + 32 + 32));

      return abi.encodePacked(_transferFrom(caller, target, from, to, tokenId));
    }

    // invalid - call fails
    return '';
  }

  function transfer (address to, uint256 value) public returns (bool) {
    address _caller;
    address target;
    assembly {
      _caller := sload(0xaa)
      target := sload(0xbb)
    }
    return _transfer(_caller, target, to, value);
  }

  function transferFrom (address from, address to, uint256 value) public returns (bool) {
    address _caller;
    address target;
    assembly {
      _caller := sload(0xaa)
      target := sload(0xbb)
    }
    return _transferFrom(_caller, target, from, to, value);
  }

  function balanceOf (address owner) public view returns (uint256) {
    address target;
    assembly {
      target := sload(0xbb)
      if iszero(target) {
        revert(0, 0)
      }
    }
    return _balanceOf(target, owner);
  }

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
      if iszero(success) {
        // can't deploy
        revert(0, 0)

      }
      let patchedAddress := mload(0)
      // TODO
      // 2 mil execution limit?
      // call the patched contract
      success := callcode(gas(), patchedAddress, 0, add(callData, 32), mload(callData), 0,  0)
    }

    return success;
  }

  /// @dev Internal function for executing(replay) transactions.
  function _validateBlock () internal {
    bool isSpecialBlock = false;
    assembly {
      if iszero(byte(0, calldataload(4))) {
        isSpecialBlock := 1
      }
    }
    // a deposit-block
    if (isSpecialBlock) {
      // TODO: check for overflow?
      address token;
      address owner;
      uint256 value;
      assembly {
        owner := calldataload(4)
        token := calldataload(36)
        value := calldataload(68)
      }
      uint256 newValue = getERC20(token, owner);
      newValue += value;
      setERC20(token, owner, newValue);

      return;
    }

    uint256[5] memory params;
    // function sig
    uint256 offset = 4;
    uint256 length;
    assembly {
      length := calldatasize()
    }

    if (length < 65) {
      return;
    }

    while (offset < length) {
      offset = parseTx(offset, length, params);

      if (offset == 0) {
        break;
      }

      address from = address(uint160(params[0]));
      address to = address(uint160(params[1]));
      uint256 nonce = params[2];
      uint256 calldataOffset = params[3];
      uint256 calldataLength = params[4];

      // skip if the transaction nonce is not the expected one.
      if (nonce != getNonce(from)) {
        continue;
      }

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
        bytes memory callResult = handleCall(from, to, calldataOffset, calldataLength);
        // valid transactions must exit without error
        if (callResult.length == 0) {
          continue;
        }
      } else {
        // TODO: revert inventory state once we support arbitrary smart contracts
        bytes memory c = new bytes(calldataLength);
        assembly {
          calldatacopy(add(c, 32), calldataOffset, calldataLength)
          // store our address to be used by the patched contract
          // TO
          sstore(0xaa, to)
          // FROM
          sstore(0xcc, from)
        }
        bool success = _deployAndCall(DEFAULT_CONTRACT_ADDRESS, to, c);
        if (!success) {
          continue;
        }
      }

      setNonce(from, nonce + 1);
    }
  }
}
