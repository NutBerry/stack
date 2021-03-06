pragma solidity ^0.6.2;

// TODO
// - investigate possible re-entrancy attacks
// - use state-roots for per-account basis?
// - Define error codes for those silent revert(0, 0)'s
// - Improve storage patterns
contract _Bridge {
  uint16 public constant VERSION = 3;
  uint16 public constant MAX_BLOCK_SIZE = 16192;
  uint16 public constant MAX_SOLUTION_SIZE = 8192;
  // >~14 minutes | in Blocks
  uint16 public constant INSPECTION_PERIOD = 60;
  // 1 ether
  uint256 public constant BOND_AMOUNT = 1000000000000000000;

  // convenience for clients
  uint256 public createdAtBlock;
  // highest finalized block
  uint256 public finalizedHeight;
  // highest not finalized block
  uint256 pendingHeight;
  // tracks the block offset in chunked challenges
  uint256 challengeOffset;
  // block number > keccak256(blockhash, block proposer)
  mapping (uint256 => bytes32) blocks;
  // block number > solutionHash
  mapping (uint256 => bytes32) blockSolutions;
  // block number > timeOfSubmission | in blocks
  mapping (uint256 => uint256) timeOfSubmission;

  event Deposit(address token, address owner, uint256 value);
  event BlockBeacon();
  event NewSolution(uint256 blockNumber, bytes32 solutionHash);

  /// @dev Computes blockHash from calldata excluding function signature.
  /// @param nonce The block nonce / block number.
  /// @return blockHash The hash of the nonce + block-data..
  function _blockHash (uint256 nonce) internal pure returns (bytes32 blockHash) {
    assembly {
      let size := sub(calldatasize(), 4)
      // MAX_BLOCK_SIZE
      if or(gt(size, 16192), iszero(size)) {
        revert(0, 0)
      }

      mstore(0, nonce)
      let tmp := mload(0x40)
      calldatacopy(32, 4, size)
      blockHash := keccak256(0, add(size, 32))
      mstore(0x40, tmp)
      mstore(0x60, 0)
    }
  }

  /// @dev Clears storage slots and moves `finalizedHeight` to `blockNumber`.
  /// @param blockNumber The number of the block we finalized.
  function _resolveBlock (uint256 blockNumber) internal {
    finalizedHeight = blockNumber;

    delete blocks[blockNumber];
    delete blockSolutions[blockNumber];
    delete timeOfSubmission[blockNumber];
    challengeOffset = 0;
  }

  /// @dev Reverts if the `caller()` is not a regular account.
  function _checkCaller () internal {
    assembly {
      if iszero(
        eq(
          extcodehash(caller()),
          0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
        )
      ) {
        revert(0, 0)
      }
    }
  }
}
