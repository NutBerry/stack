pragma solidity ^0.5.2;

import './NutBerryRuntime.sol';

contract Replayer is NutBerryRuntime {
  // needs to be replaced with the deployed address
  address constant DEFAULT_CONTRACT_ADDRESS = 0xabCDeF0123456789AbcdEf0123456789aBCDEF01;

  /// @dev Internal helper for parsing RLP encoded transactions from calldata.
  /// Reverts if the transaction is malformed
  function parseTx (
    uint256 offset,
    uint256 boundary,
    uint256[5] memory params
  ) internal returns (uint256) {
    if (offset >= boundary) {
      return offset;
    }

    assembly {
      function parseInt (offset, length, boundary) -> result {
        if gt(add(offset, length), boundary) {
          revert(0, 0)
        }

        for { let i := 0 } lt(i, length) { i := add(i, 1) } {
          let v := calldataload(add(offset, i))
          v := byte(0, v)
          result := add(mul(result, 256), v)
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
          revert(0, 0)
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
            revert(0, 0)
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
            revert(0,0)
          }
        }

        if eq(i, 4) {
          if xor(lengthOfData, 20) {
            revert(0, 0)
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
      }

      if gt(add(offset, 65), boundary) {
        revert(0, 0)
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

    return offset;
  }

  /// @dev Internal function for executing(replay) transactions.
  function _replay () internal {
    // 0x80 - 0x880(2k) for in-memory inventory-storage
    assembly {
      mstore(0x40, 0x880)
    }

    EVM memory evm;
    codeFromAddress(evm, DEFAULT_CONTRACT_ADDRESS);
    // stack with max. 32 slots
    newStack(evm, 32);

    uint256[5] memory params;
    // function sig
    uint256 offset = 4;
    uint256 length;
    assembly {
      length := calldatasize()
    }

    while (offset < length) {
      offset = parseTx(offset, length, params);

      address from = address(uint160(params[0]));
      address to = address(uint160(params[1]));
      uint256 nonce = params[2];
      uint256 calldataoffset = params[3];
      uint256 calldatalength = params[4];

      // skip if the transaction nonce is not the expected one.
      if (nonce != getNonce(from)) {
        continue;
      }

      // setup evm environment
      evm.caller = from;
      evm.target = to;
      evm.stackSize = 0;
      // data
      evm.callDataOffset = calldataoffset;
      evm.callDataLength = calldatalength;

      memReset(evm);

      // run the code
      _run(evm, 0, 0);

      // valid transactions must exit without error
      if (evm.errno != 0) {
        // TODO: revert inventory state once we support arbitrary smart contracts
        continue;
      }

      setNonce(from, nonce + 1);
    }
  }
}
