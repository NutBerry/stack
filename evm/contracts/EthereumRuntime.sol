pragma solidity ^0.5.2;

import './EVMRuntime.sol';


contract EthereumRuntime is EVMRuntime {

  // Init EVM with given stack and memory and execute from the given opcode
  // solhint-disable-next-line function-max-lines
  function execute(
    address code,
    uint pc,
    uint8 errno,
    uint stepCount,
    bytes memory data,
    bytes32[] memory stack,
    bytes32[] memory mem
  ) public returns (uint, uint, bytes32, bytes32[] memory, bytes32[] memory, bytes memory) {
    // solhint-disable-next-line avoid-low-level-calls
    EVM memory evm;

    evm.callDataLength = data.length;
    evm.callDataOffset = 260;

    evm.errno = errno;

    codeFromAddress(evm, code);
    stackFromArray(evm, stack, 64);
    memFromArray(evm, mem);

    _run(evm, pc, stepCount);

    bytes32 hashValue = stateHash(evm);

    return (
      evm.pc,
      evm.errno,
      hashValue,
      stackToArray(evm),
      memToArray(evm),
      evm.returnData
    );
  }

  function stateHash(EVM memory evm) internal view returns (bytes32) {
    bytes32 dataHash = keccak256(abi.encodePacked(
      evm.returnData,
      evm.errno
    ));

    bytes32 hashValue = keccak256(abi.encodePacked(
      dataHash,
      evm.memSize,
      evm.stackSize,
      evm.pc,
      evm.caller,
      evm.target
    ));

    return hashValue;
  }
}
