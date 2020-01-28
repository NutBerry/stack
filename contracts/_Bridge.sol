pragma solidity ^0.5.2;

import './LEVM.sol';

// TODO: investigate possible re-entrancy attacks
contract _Bridge is LEVM {
  uint16 public constant VERSION = 2;
  uint16 public constant MAX_BLOCK_SIZE = 16192;
  uint16 public constant MAX_SOLUTION_SIZE = 2048;
  // >~14 minutes | in Blocks
  uint16 public constant INSPECTION_PERIOD = 60;
  // 1 ether
  uint256 public constant BOND_AMOUNT = 1000000000000000000;
  // TODO
  // - use state-roots for per-account basis?
  //   mapping(address => bytes32) stateRoots;
  // - Define error codes for those silent revert(0, 0)'s
  // convenience for clients
  uint256 public createdAtBlock;
  // highest finalized block
  uint256 public currentBlock;
  // highest not finalized block
  uint256 highestPendingBlock;
  // tracks the block offset in chunked disputes
  uint256 disputeOffset;
  // blockHash > block proposer
  mapping (bytes32 => address) blocks;
  // blockHash > solutionHash
  mapping (bytes32 => bytes32) blockSolutions;

  // TODO: get rid of these storage patterns
  // blockHash > timeOfSubmission | in blocks
  mapping (bytes32 => uint256) timeOfSubmission;

  event Deposit(address token, address owner, uint256 value);
  event BlockBeacon();
  event NewSolution(bytes32 blockHash, bytes32 solutionHash);

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

  /// @dev Checks if `blockHash` is the current block that needs finalization.
  function _checkBlock (bytes32 blockHash) internal {
    if (blocks[blockHash] == address(0)) {
      revert();
    }
  }

  /// @dev Internal function to check if caller satisfies common conditions.
  function _checkCaller () internal {
    // Do not allow contracts
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

  /// @dev Internal function to check if caller satisfies common conditions.
  function _checkBond () internal {
    if (msg.value != BOND_AMOUNT) {
      revert();
    }
  }

  /// @dev Callback from the Verifier once a dispute is resolved
  function _resolveBlock (bytes32 blockHash, address payable solver) internal {
    if (blocks[blockHash] == address(0)) {
      revert();
    }

    currentBlock = currentBlock + 1;

    address payable blockProducer = address(bytes20(blocks[blockHash]));

    delete blocks[blockHash];
    delete blockSolutions[blockHash];
    delete timeOfSubmission[blockHash];
    disputeOffset = 0;

    // we might not have a bond if it's a special block
    if (address(this).balance >= BOND_AMOUNT) {
      solver.transfer(BOND_AMOUNT / 2);
      blockProducer.transfer(BOND_AMOUNT / 2);
    }
    // TODO
    // block producer lock period
    // payout to finalizer - leftover bond (gas refunder) goes to block producer
  }
}
