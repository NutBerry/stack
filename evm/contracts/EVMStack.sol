pragma solidity ^0.5.2;

import "./EVMBase.sol";


contract EVMStack is EVMBase {
  function newStack (EVM memory state, uint256 maxStackSize) internal pure {
    state.stackSize = 0;
    state.maxStackSize = maxStackSize;
    state.dataPtr = allocate32(maxStackSize);
  }

  function stackFromCalldata (EVM memory state, uint256 size, uint256 ptr, uint256 maxStackSize) internal pure {
    state.stackSize = size;
    state.maxStackSize = maxStackSize;
    state.dataPtr = allocate32(maxStackSize);

    for (uint i = 0; i < size; i++) {
      uint slot = state.dataPtr + 32 * i;
      assembly {
        let val := calldataload(add(ptr, mul(32, i)))
        mstore(slot, val)
      }
    }
  }

  function stackFromArray (EVM memory state, bytes32[] memory sArr, uint256 maxStackSize) internal pure {
    state.stackSize = sArr.length;
    state.maxStackSize = maxStackSize;
    state.dataPtr = allocate32(maxStackSize);

    for (uint i = 0; i < sArr.length; i++) {
      bytes32 val = sArr[i];
      uint slot = state.dataPtr + 32 * i;
      assembly {
        mstore(slot, val)
      }
    }
  }

  function stackToArray (EVM memory state) internal pure returns (bytes32[] memory arr) {
    if (state.stackSize == 0) {
      return arr;
    }
    arr = new bytes32[](state.stackSize);
    uint dest;
    assembly {
      dest := add(arr, 0x20)
    }
    memcopy32(state.dataPtr, dest, state.stackSize);
  }

  function stackValueAt (EVM memory state, uint256 position) internal pure returns (uint256) {
    uint val;
    uint slot = state.dataPtr + (position * 32);

    assembly {
      val := mload(slot)
    }

    return val;
  }

  function stackPush (EVM memory state, uint val) internal pure {
    if (state.stackSize + 1 > state.maxStackSize) {
      // TODO
      state.errno = 0xff;
      return;
    }

    uint slot = state.dataPtr + 32 * state.stackSize++;
    assembly {
      mstore(slot, val)
    }
  }

  function stackPop (EVM memory state) internal pure returns (uint) {
    if (state.stackSize == 0) {
      // TODO
      state.errno = 0xff;
      return 0;
    }

    uint data;
    uint slot = state.dataPtr + --state.stackSize * 32;
    assembly {
      data := mload(slot)
      //mstore(slot, 0) // remove?
    }
    return data;
  }

  function stackDup (EVM memory state, uint n) internal pure {
    if (n > state.stackSize) {
      // TODO
      state.errno = 0xff;
      return;
    }
    if (state.stackSize + 1 > state.maxStackSize) {
      state.errno = 0xff;
      return;
    }

    uint data;
    uint slot1 = state.dataPtr + (state.stackSize - n) * 32;
    assembly {
      data := mload(slot1)
    }
    uint slot2 = state.dataPtr + 32 * state.stackSize++;
    assembly {
      mstore(slot2, data)
    }
  }

  function stackSwap (EVM memory state, uint n) internal pure {
    if (n > state.stackSize) {
      // TODO
      state.errno = 0xff;
      return;
    }
    uint slot1 = state.dataPtr + (state.stackSize - 1) * 32;
    uint slot2 = state.dataPtr + (state.stackSize - n - 1) * 32;
    assembly {
      let data1 := mload(slot1)
      mstore(slot1, mload(slot2))
      mstore(slot2, data1)
    }
  }
}
