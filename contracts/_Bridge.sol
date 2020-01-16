pragma solidity ^0.5.2;

import './LEVM.sol';

// TODO: investigate possible re-entrancy attacks
contract _Bridge is LEVM {
  uint16 public constant VERSION = 2;
  uint256 public constant MAX_BLOCK_SIZE = 8096;
  uint256 public constant MAX_SOLUTION_SIZE = 2048;
  // 1 ether
  uint256 public constant BOND_AMOUNT = 1000000000000000000;
  // >~14 minutes | in Blocks
  uint256 public constant INSPECTION_PERIOD = 60;
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
  // blockHash > blockNumber
  mapping (bytes32 => uint256) blocks;
  // blockHash > solutionHash
  mapping (bytes32 => bytes32) blockSolutions;

  // TODO: get rid of these storage patterns
  // blockHash > timeOfSubmission | in blocks
  mapping (bytes32 => uint256) timeOfSubmission;
  // blockHash > submitter/solver
  mapping (bytes32 => address) solverOfBlock;
  // blockHash > challenger
  mapping (bytes32 => address) challengerOfBlock;

  event Deposit(address token, address owner, uint256 value);
  event BlockBeacon();
  event NewSolution(bytes32 blockHash, bytes32 solutionHash);
  event NewDispute(bytes32 blockHash);
  event Slashed(bytes32 blockHash, bool solverWon);

  function _blockHash (uint256 nonce) internal pure returns (bytes32 blockHash) {
    assembly {
      let size := sub(calldatasize(), 4)
      // MAX_BLOCK_SIZE
      if or(gt(size, 8096), iszero(size)) {
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
    uint256 cblock = currentBlock + 1;
    if (blocks[blockHash] != cblock) {
      revert();
    }
  }

  /// @dev Internal function to check if caller satisfies common conditions.
  function _checkBond () internal {
    if (msg.value != BOND_AMOUNT) {
      revert();
    }
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

  /// @dev Callback from the Verifier once a dispute is resolved
  function _resolveBlock (bytes32 blockHash) internal {
    uint256 cblock = currentBlock + 1;
    if (blocks[blockHash] != cblock) {
      revert();
    }

    currentBlock = cblock;
    delete blocks[blockHash];
    delete blockSolutions[blockHash];
    delete timeOfSubmission[blockHash];

    // If the solution is deleted by some other resolved dispute
    // - Only return challenger's bond
    address payable solver = address(bytes20(solverOfBlock[blockHash]));
    address payable challenger = address(bytes20(challengerOfBlock[blockHash]));

    delete solverOfBlock[blockHash];
    delete challengerOfBlock[blockHash];

    // TODO
    // Implement new incentive model
    // If solution equals solver's solution
    //   if challenged:
    //     solver gets (bond + FEE) back
    //     challenger gets (bond - FEE) back
    //     block submitter gets bond back
    //   else
    //     solver gets (bond + FEE) back
    //     block submitter gets (bond - FEE) back
    //  else (solver is wrong; implies challenged)
    //    challenger gets (bond + FEE) back
    //    challenger gets solver's bond
    //    block submitter gets bond back

    // TODO
    // Compare solution-set
    bool solverWon = true;
    // Winner gets all remaining bonds from the open solutions.
    uint256 bonds = address(this).balance;
    if (solverWon) {
      // solver gets bond
      solver.transfer(bonds);
    } else {
      // challenger gets bond * 2 (challenger's + solver's bond)
      challenger.transfer(bonds);
    }

    emit Slashed(blockHash, solverWon);
  }
}
