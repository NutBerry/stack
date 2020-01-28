pragma solidity ^0.5.2;

import './../LEVM.sol';

contract TestLEVM is LEVM {
  function testParseTx () public {
    uint256[5] memory params;
    // function sig
    uint256 offset = 4;
    uint256 length;
    assembly {
      length := calldatasize()
    }

    while (offset < length) {
      offset = _parseTx(offset, params);

      if (params[0] == 0) {
        // invalid sig
        continue;
      }

      assembly {
        let callDataOffset := mload(add(params, 96))
        let callDataSize := mload(add(params, 128))

        calldatacopy(mload(0x40), callDataOffset, callDataSize)
        log3(mload(0x40), callDataSize, mload(params), mload(add(params, 32)), mload(add(params, 64)))
      }
    }
  }
}
