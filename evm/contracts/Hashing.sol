pragma solidity ^0.5.2;


contract Hashing {
  bytes32 constant internal DEFAULT_HASH = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;

  function memHash(bytes32[] memory _mem) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(_mem));
  }

  function dataHash(bytes memory _data) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(_data));
  }

  function stackHash(bytes32[] memory stack, bytes32 _sibling) internal pure returns (bytes32) {
    bytes32 hash = _sibling;

    for (uint i = 0; i < stack.length; i++) {
      assembly {
        mstore(0, hash)
        mstore(0x20, mload(add(add(stack, 0x20), mul(i, 0x20))))
        hash := keccak256(0, 0x40)
      }
    }

    return hash;
  }

  // TODO: add step number
  // Question: before we *eventually* implement `FragmentTree` for `returnData`,
  // should we also hash the bytelength from `returnData`.
  // This is probably not needed because the array would be too large anyway to verify on-chain
  // for a possible hash-collision
  function stateHash(
    uint256 pc,
    uint256 stackSize,
    uint256 memSize,
    bytes32 _stackHash,
    bytes32 _memHash,
    bytes32 _dataHash,
    bytes32 returnDataHash
  ) internal pure returns (bytes32) {
    bytes32 preHash = keccak256(
      abi.encodePacked(
        _stackHash,
        _memHash,
        _dataHash,
        pc,
        stackSize,
        memSize
      )
    );

    return keccak256(abi.encodePacked(preHash, returnDataHash));
  }

  function initialStateHash(bytes32 dataHash) internal pure returns (bytes32) {
    return stateHash(0, 0, 0, 0, DEFAULT_HASH, dataHash, DEFAULT_HASH);
  }
}
