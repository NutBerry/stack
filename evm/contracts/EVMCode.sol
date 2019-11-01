pragma solidity ^0.5.2;

import "./EVMBase.sol";


contract EVMCode is EVMBase {

  function codeFromAddress(EVM memory state, address codeAddress) internal {
    state.codeAddress = codeAddress;
    uint codeSize;
    assembly {
      codeSize := extcodesize(codeAddress)
    }

    state.codeLength = codeSize;
  }

  /// @dev return the opcode at position if known. Otherwise return 0
  function getOpcodeAt(EVM memory state, uint pos) internal view returns (uint8 opcode) {
    address codeContractAddress = state.codeAddress;

    if (pos >= state.codeLength) {
      return 0;
    }

    assembly {
      extcodecopy(codeContractAddress, 31, pos, 1)
      opcode := mload(0)
    }
  }

  /// @dev return code as bytes array, from a position for a number of bytes
  /// revert if the known code cannot fulfill the requirement
  // solhint-disable-next-line function-max-lines
  function codeToBytes(EVM memory state, uint pos, uint numBytes) internal view returns (bytes memory bts) {
    address codeContractAddress = state.codeAddress;
    assembly {
      bts := mload(0x40)
      // padding up to word size
      mstore(0x40, add(bts, and(add(add(numBytes, 0x20), 0x1f), not(0x1f))))
      mstore(bts, numBytes)
    }

    assembly {
      extcodecopy(codeContractAddress, add(bts, 0x20), pos, numBytes)
    }
  }

  function codeToUint(EVM memory state, uint pos, uint numBytes) internal view returns (uint data) {
    // if pos + numBytes > self.length, we get zeroes.
    // this is the behaviour we want

    if (pos >= state.codeLength) {
      return 0;
    }

    address codeContractAddress = state.codeAddress;

    assembly {
      extcodecopy(codeContractAddress, 0, pos, numBytes)
      data := mload(0)
    }
    data = data >> 8 * (32 - numBytes);
  }
}
