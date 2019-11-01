pragma solidity ^0.5.2;

import "./EVMConstants.sol";


contract EVMBase is EVMConstants {
  // what we do not track  (not complete list)
  // call depth: as we do not support stateful things like call to other contracts
  // staticExec: same as above, we only support precompiles, higher implementations still can intercept calls
  struct EVM {
    uint memSize; // in words
    uint next;

    uint8 errno;
    uint n;
    uint pc;

    address codeAddress;
    uint codeLength;

    uint callDataLength;
    uint callDataOffset;
    bytes returnData;

    uint256 maxStackSize;
    uint256 stackSize;
    uint256 dataPtr;

    // caller is also origin, as we do not support calling other contracts
    address caller;
    address target;
  }

  function UintToBytes(uint x) internal pure returns (bytes memory bts) {
    bts = new bytes(32);
    assembly {
      mstore(add(bts, 0x20), x)
    }
  }

  /// @dev Allocates 'words' words of memory.
  function allocate32(uint words) internal pure returns (uint addr) {
    uint numBytes = words * 32;
    assembly {
      // free memory address 0x40 - constants doesn't work in inline assembly.
      addr := mload(0x40)
      // addr is a free memory pointer 
      mstore(0x40, add(addr, numBytes))
    }
  }

  /// @dev Copies 'words*32' bytes from 'srcPtr' to 'destPtr'.
  /// NOTE: This function does not check if memory is allocated, it only copies the bytes.
  function memcopy32(uint srcPtr, uint destPtr, uint words) internal pure {
    // Copy word-length chunks.
    for (uint i = 0; i < words; i++) {
      uint mp = i * 32;
      assembly {
        mstore(add(destPtr, mp), mload(add(srcPtr, mp)))
      }
    }
  }

  function callDataLoad (EVM memory state, uint addr) internal returns (uint256) {
    uint offset = state.callDataOffset;

    // callData is not provided
    if (offset == 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff) {
      revert();
    }

    // When some or all of the 32 bytes fall outside of the calldata array,
    // we have to replace those bytes with zeroes.
    uint val;
    if (addr >= state.callDataLength) {
      val = 0;
    } else {
      assembly {
        val := calldataload(add(offset, addr))
      }
      if (addr + WORD_SIZE > state.callDataLength) {
        val &= ~uint(0) << 8 * (32 - state.callDataLength + addr);
      }
    }

    return val;
  }

  function arrayFromCalldata (uint256 memSize, uint256 memInPtr) internal pure returns (bytes memory) {
    bytes memory ret;
    assembly {
      let src := memInPtr
      let size := memSize
      let ptr := mload(0x40)
      ret := ptr

      // update free memory pointer, we allocate 32 + size
      mstore(0x40, add(ptr, add(32, size)))
      // set mem.size
      mstore(ptr, size)

      ptr := add(ptr, 32)

      for { let i := 0 } lt(i, size) { i := add(i, 32) } {
        mstore(ptr, calldataload(add(src, mul(0x20, i))))

        ptr := add(ptr, 32)
      }
    }
    return ret;
  }
}
