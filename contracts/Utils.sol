pragma solidity ^0.6.2;

contract Utils {
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

  function isERC721 (address token, uint256 tokenId) public view returns (bool ok) {
    // TODO
    // check for required gas limit and revert if it is too low
    assembly {
      // ownerOf
      let sig := shl(224, 0x6352211e)
      mstore(0x80, sig)
      mstore(0x84, tokenId)
      mstore(0, 0)
      let success := staticcall(gas(), token, 0x80, 36, 0, 32)
      if eq(success, 1) {
        if gt(mload(0), 1) {
          ok := 1
        }
      }
    }
  }

  /// @dev Internal function that checks if calldata is a special block
  function _isSpecialBlock () internal returns (bool ret) {
    assembly {
      if eq(calldatasize(), 76) {
        ret := 1
      }
    }
  }
}
