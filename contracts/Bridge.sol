pragma solidity ^0.5.2;

import './_Bridge.sol';

// TODO: investigate possible re-entrancy attacks
contract Bridge is _Bridge {
  constructor () public {
    createdAtBlock = block.number;
  }

  /// @dev Deposit `token` and value (`amountOrId`) into bridge.
  /// Only the ERC20 standard is supported for now.
  function deposit (address token, uint256 amountOrId) public {
    // TODO: check for zero amountOrId?

    uint256 pending = highestPendingBlock + 1;
    bytes32 blockHash;
    assembly {
      mstore(0x80, caller())
      mstore(0xa0, token)
      mstore(0xc0, amountOrId)
      mstore(0xe0, pending)
      blockHash := keccak256(0x80, 128)

      // transferFrom
      let sig := shl(224, 0x23b872dd)
      mstore(0x80, sig)
      mstore(0x84, caller())
      mstore(0xa4, address())
      mstore(0xc4, amountOrId)
      let success := call(gas(), token, 0, 0x80, 0x64, 0, 0x20)
      if iszero(success) {
        revert(0, 0)
      }
      if iszero(mload(0)) {
        revert(0, 0)
      }
    }

    blocks[blockHash] = pending;
    highestPendingBlock = pending;

    emit Deposit(token, msg.sender, amountOrId);
  }

  /// @dev Withdraw `token` and `amountOrId` from bridge.
  /// `tokenId` is a placeholder until we support ERC721.
  function withdraw (address token, uint256 /*tokenId*/) public {
    uint256 val = getExitValue(token, msg.sender);
    setExitValue(token, msg.sender, 0);

    assembly {
      let sig := shl(224, 0x23b872dd)
      mstore(0x80, sig)
      mstore(0x84, address())
      mstore(0xa4, caller())
      mstore(0xc4, val)
      let success := call(gas(), token, 0, 0x80, 0x64, 0, 0x20)
      if iszero(success) {
        revert(0, 0)
      }
      if iszero(mload(0)) {
        revert(0, 0)
      }
    }
  }

  /// @dev Submit a transaction blob (a block)
  function submitBlock () public payable {
    _checkBond();

    // Special blocks like deposits-blocks starts with a zero byte.
    // Revert if someone is trying to submit such a block.
    assembly {
      if iszero(byte(0, calldataload(4))) {
        revert(0, 0)
      }
    }

    bytes32 blockHash = _blockHash();
    uint256 pending = highestPendingBlock + 1;
    blocks[blockHash] = pending;
    highestPendingBlock = pending;

    emit BlockBeacon();
  }

  /// @dev Register solution given `blockHash`.
  /// Triggers INSPECTION_PERIOD in number of root blocks
  function submitSolution (
    bytes32 blockHash,
    bytes32 solutionHash
  ) public payable
  {
    _checkBond();
    _checkBlock(blockHash);

    require(solutionHash != 0);
    require(blockSolutions[blockHash] == 0);

    blockSolutions[blockHash] = solutionHash;
    timeOfSubmission[blockHash] = block.number;
    solverOfBlock[blockHash] = msg.sender;

    emit NewSolution(blockHash, solutionHash);
  }

  /// @dev Challenge a solution
  function dispute () public payable {
    bytes32 blockHash = _blockHash();

    _checkBond();
    _checkBlock(blockHash);

    uint256 time = timeOfSubmission[blockHash];
    // Revert if no solution exists or if we are already over the inspection period.
    if (time == 0 || block.number > time + INSPECTION_PERIOD) {
      revert();
    }

    challengerOfBlock[blockHash] = msg.sender;

    // TODO: challenge needs to be chunkable once we support smart contracts
    _resolveBlock(blockHash);
    _validateBlock();
  }

  /// @dev Returns true if `blockHash` can be finalized, else false.
  function canFinalizeBlock (bytes32 blockHash) public view returns (bool) {
    uint256 time = timeOfSubmission[blockHash];
    // solution too young
    if (time == 0 || block.number <= (time + INSPECTION_PERIOD)) {
      return false;
    }

    // if there are still open challenges
    if (challengerOfBlock[blockHash] != address(0)) {
      return false;
    }

    return true;
  }

  /// @dev Finalize solution and move to the next block.
  /// Solution must be past the `INSPECTION_PERIOD`.
  function finalizeSolution (bytes32 blockHash, bytes calldata) external {
    bytes32 solutionHash;
    assembly {
      let size := sub(calldatasize, 100)
      // MAX_SOLUTION_SIZE
      if gt(size, 2048) {
        revert(0, 0)
      }
      calldatacopy(0x80, 100, size)
      solutionHash := keccak256(0x80, size)
    }

    require(solutionHash == blockSolutions[blockHash]);

    if (!canFinalizeBlock(blockHash)) {
      revert();
    }

    _resolveBlock(blockHash);

    // update our storage
    assembly {
      let solution := 68
      let end := add(add(solution, 0x20), calldataload(solution))

      for { let ptr := add(solution, 0x20) } lt(ptr, end) { ptr := add(ptr, 0x40) } {
        let key := calldataload(ptr)
        let val := calldataload(add(ptr, 0x20))

        sstore(key, val)
      }
    }
  }

  /// @dev direct replay the next pending block
  function replay () public {
    // validate the data
    bytes32 blockHash = _blockHash();

    _resolveBlock(blockHash);
    _validateBlock();
  }
}
