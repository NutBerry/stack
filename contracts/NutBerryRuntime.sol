pragma solidity ^0.5.2;

import './../evm/contracts/EVMRuntime.sol';
import './Inventory.sol';


contract NutBerryRuntime is EVMRuntime, Inventory {
  bytes4 constant internal FUNC_SIG_BALANCE_OF = hex'70a08231';
  bytes4 constant internal FUNC_SIG_ALLOWANCE = hex'dd62ed3e';
  bytes4 constant internal FUNC_SIG_TRANSFER = hex'a9059cbb';
  bytes4 constant internal FUNC_SIG_TRANSFER_FROM = hex'23b872dd';
  //bytes4 constant internal FUNC_SIG_OWNER_OF = hex'6352211e';
  //bytes4 constant internal FUNC_SIG_GET_APPROVED = hex'081812fc';
  //bytes4 constant internal FUNC_SIG_READ_DATA = hex'37ebbc03';
  //bytes4 constant internal FUNC_SIG_WRITE_DATA = hex'a983d43f';
  //bytes4 constant internal FUNC_SIG_BREED = hex'451da9f9';

  function handleCALL(EVM memory state) internal {
    // gasLimit
    stackPop(state);

    address target = address(stackPop(state));
    uint value = stackPop(state);
    uint inOffset = stackPop(state);
    uint inSize = stackPop(state);
    uint retOffset = stackPop(state);
    uint retSize = stackPop(state);

    bytes memory returnData = interceptCall(state, target, inOffset, inSize);
    state.returnData = returnData;

    if (returnData.length != 0) {
      stackPush(state, 1);
    } else {
      stackPush(state, 0);
    }

    memStoreBytesAndPadWithZeroes(state, returnData, 0, retOffset, retSize);
  }

  function handleSTATICCALL(EVM memory state) internal {
    // gasLimit
    stackPop(state);

    address target = address(stackPop(state));
    uint inOffset = stackPop(state);
    uint inSize = stackPop(state);
    uint retOffset = stackPop(state);
    uint retSize = stackPop(state);

    bytes memory returnData = interceptCall(state, target, inOffset, inSize);
    state.returnData = returnData;

    if (returnData.length != 0) {
      memStoreBytesAndPadWithZeroes(state, returnData, 0, retOffset, retSize);
      stackPush(state, 1);
    } else {
      stackPush(state, 0);
    }
  }

  /// @dev This is used to by solc to check if a address is indeed a contract (has code).
  function handleEXTCODESIZE(EVM memory state) internal {
    address target = address(uint160(stackPop(state)));

    // return non-zero length to signal ok
    stackPush(state, 1);
  }

  // solhint-disable-next-line function-max-lines
  function interceptCall(EVM memory state, address target, uint inOffset, uint inSize) internal returns (bytes memory) {
    bytes4 functionSig = bytes4(bytes32(memLoad(state, inOffset)));

    // TODO: do real checks
    // check inSize/inOffset bounds

    if (functionSig == FUNC_SIG_BALANCE_OF) {
      address owner = address(uint160(memLoad(state, inOffset + 4)));

      return balanceOf(target, owner);
    }

    if (functionSig == FUNC_SIG_ALLOWANCE) {
      address owner = address(uint160(memLoad(state, inOffset + 4)));
      address spender = address(uint160(memLoad(state, inOffset + 4 + 32 )));

      return allowance(target, owner, spender);
    }

    if (functionSig == FUNC_SIG_TRANSFER) {
      address to = address(uint160(memLoad(state, inOffset + 4)));
      uint value = memLoad(state, inOffset + 4 + 32);

      return transfer(state.caller, target, to, value);
    }

    if (functionSig == FUNC_SIG_TRANSFER_FROM) {
      address from = address(uint160(memLoad(state, inOffset + 4)));
      address to = address(uint160(memLoad(state, inOffset + 4 + 32 )));
      uint256 tokenId = uint256(memLoad(state, inOffset + 4 + 32 + 32));

      return transferFrom(state.caller, target, from, to, tokenId);
    }

    // invalid - call fails
    return '';
  }

  // does need to handle storage lookups
  function handleSLOAD(EVM memory state) internal {
    uint key = stackPop(state);
    uint res;

    assembly {
      res := sload(key)
    }

    stackPush(state, res);
  }

  function handleSSTORE(EVM memory state) internal {
    uint key = stackPop(state);
    uint val = stackPop(state);

    assembly {
      sstore(key, val)
    }
  }
}
