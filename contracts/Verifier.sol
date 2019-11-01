pragma solidity ^0.5.2;

import './../evm/contracts/EVMConstants.sol';
import './../evm/contracts/Hashing.sol';


contract Verifier is EVMConstants, Hashing {
  uint8 constant internal SOLVER_RESPONDED = 1 << 0;
  uint8 constant internal CHALLENGER_RESPONDED = 1 << 1;
  uint8 constant internal SOLVER_VERIFIED = 1 << 2;
  uint8 constant internal CHALLENGER_VERIFIED = 1 << 3;
  uint8 constant internal START_OF_EXECUTION = 1 << 4;
  uint8 constant internal END_OF_EXECUTION = 1 << 5;
  uint8 constant internal INITIAL_STATE = START_OF_EXECUTION | END_OF_EXECUTION;

  /// @dev The time (in seconds) the participants have to react to `submitRound, submitProof`.
  uint16 constant public timeoutDuration = 900;

  struct Dispute {
    bytes32 initialStateHash;

    bytes32 solverPath;
    bytes32 challengerPath;
    uint256 treeDepth;
    bytes32 witness;

    bytes32 solverLeft;
    bytes32 solverRight;
    bytes32 challengerLeft;
    bytes32 challengerRight;

    uint8 state;

    uint256 timeout; // in seconds
  }

  event DisputeNewRound(bytes32 indexed disputeId, uint256 timeout, bytes32 solverPath, bytes32 challengerPath);

  mapping (bytes32 => Dispute) public disputes;

  /// @dev game not timeout yet
  modifier onlyPlaying(bytes32 disputeId) {
    Dispute storage dispute = disputes[disputeId];
    require(dispute.timeout >= block.timestamp, 'game timed out');
    require((dispute.state & SOLVER_VERIFIED == 0) && (dispute.state & CHALLENGER_VERIFIED == 0), 'dispute resolved');
    _;
  }

  /// @dev init a new dispute
  function initGame(
    bytes32 solverHashRoot,
    bytes32 challengerHashRoot,
    uint256 executionDepth,
    bytes32 dataHash
  ) internal returns (bytes32 disputeId) {
    bytes32 initialStateHash = initialStateHash(dataHash);

    disputeId = keccak256(
      abi.encodePacked(
        initialStateHash,
        solverHashRoot,
        challengerHashRoot,
        executionDepth
      )
    );

    require(disputes[disputeId].timeout == 0, 'already init');
    // do we want to prohibit early?
    // require(solverHashRoot != challengerHashRoot, 'nothing to challenge');

    disputes[disputeId] = Dispute(
      initialStateHash,
      solverHashRoot,
      challengerHashRoot,
      executionDepth,
      bytes32(0),
      solverHashRoot,
      solverHashRoot,
      challengerHashRoot,
      challengerHashRoot,
      INITIAL_STATE,
      getTimeout()
    );
  }

  /// @dev Solver or Challenger always respond with the next `computationPath-{left, right}`
  /// for the path they do not agree on.
  /// If they do not agree on both `left` and `right` they must follow/default
  /// to `left`.
  function respond(
    bytes32 disputeId,
    bytes32 computationPathLeft,
    bytes32 computationPathRight,
    bytes32 witnessPathLeft,
    bytes32 witnessPathRight
  ) public onlyPlaying(disputeId) {
    Dispute storage dispute = disputes[disputeId];

    require(dispute.treeDepth > 0, 'already reach leaf');

    bytes32 h = keccak256(abi.encodePacked(computationPathLeft, computationPathRight));

    require(
      h == dispute.solverPath || h == dispute.challengerPath,
      'wrong path submitted'
    );

    if (h == dispute.solverPath) {
      dispute.state |= SOLVER_RESPONDED;
      dispute.solverLeft = computationPathLeft;
      dispute.solverRight = computationPathRight;
    }

    if (h == dispute.challengerPath) {
      dispute.state |= CHALLENGER_RESPONDED;
      dispute.challengerLeft = computationPathLeft;
      dispute.challengerRight = computationPathRight;
    }

    updateRound(disputeId, dispute, witnessPathLeft, witnessPathRight);
  }

  function onDisputeResolved (
    bytes32 disputeId,
    bool solverWon
  ) internal
  {
  }

  function _executeState (uint256[11] memory params) internal returns (uint256 errno) {
  }

  /// @dev if they agree on `left` but not on `right`,
  /// submitProof (on-chain) verification should be called by challenger and solver
  /// to decide on the outcome.
  ///
  /// Requirements:
  /// - last execution step must end with either REVERT, RETURN or STOP to be considered complete
  /// - any execution step which does not have errno = 0 or errno = 0x07 (REVERT)
  ///    is considered invalid
  /// - the left-most (first) execution step must be a `initialStateHash`
  ///
  /// Note: if that doesnt happen, this will finally timeout and a final decision is made
  ///       in `claimTimeout`.
  // solhint-disable-next-line code-complexity
  function submitProof(
    // solhint-disable-next-line function-max-lines
  ) external {
    bytes32 disputeId;
    assembly {
      disputeId := calldataload(4)
    }

    Dispute storage dispute = disputes[disputeId];
    require(dispute.timeout >= block.timestamp, 'game timed out');
    require((dispute.state & SOLVER_VERIFIED == 0) && (dispute.state & CHALLENGER_VERIFIED == 0), 'dispute resolved');
    require(dispute.treeDepth == 0, 'Not at leaf yet');

    uint256[11] memory params;
    assembly {
      // store pointer to params at 0
      mstore(0, params)

      let dataHash := calldataload(36)
      let stackHash := calldataload(68)
      let memHash := calldataload(100)

      let stackSize := calldataload(132)
      mstore(add(mload(0), 32), stackSize)

      let memSize := calldataload(164)
      mstore(add(mload(0), 64), memSize)

      let i_pc := calldataload(196)
      mstore(mload(0), i_pc)

      let dataLength := calldataload(228)
      mstore(add(mload(0), 96), dataLength)

      let dataOffset := 260
      mstore(add(mload(0), 128), dataOffset)

      if iszero(dataLength) {
        mstore(add(mload(0), 128), 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
      }

      if gt(dataLength, 0) {
        // dataHash must be zero if calldata is provided
        if gt(dataHash, 0) {
          revert(0, 0)
        }
        calldatacopy(mload(0x40), dataOffset, dataLength)
        dataHash := keccak256(mload(0x40), dataLength)
      }

      let ptr := add(dataOffset, dataLength)

      let stackValSize := calldataload(ptr)
      mstore(add(mload(0), 160), stackValSize)

      if gt(stackValSize, stackSize) {
        revert(0, 0)
      }
      ptr := add(ptr, 32)
      let stackOffset := ptr
      mstore(add(mload(0), 192), stackOffset)
      ptr := add(stackOffset, mul(32, stackValSize))

      let memValSize := calldataload(ptr)
      mstore(add(mload(0), 224), memValSize)
      if gt(memValSize, memSize) {
        revert(0, 0)
      }

      let memOffset := add(ptr, 32)
      mstore(add(mload(0), 256), memOffset)
      if gt(memValSize, 0) {
        if gt(memHash, 0) {
          // memHash must be zero if memory is provided
          revert(0, 0)
        }
        calldatacopy(mload(0x40), memOffset, mul(32, memValSize))
        memHash := keccak256(mload(0x40), mul(32, memValSize))
      }

      let returnDataOffset := add(add(memOffset, mul(32, memSize)), 32)
      mstore(add(mload(0), 320), returnDataOffset)
      let returnDataLength := calldataload(sub(returnDataOffset, 32))
      mstore(add(mload(0), 288), returnDataLength)

      let tmp := stackHash
      for { let i := 0 } lt(i, stackValSize) { i := add(i, 1) } {
        mstore(0, tmp)
        mstore(0x20, calldataload(add(stackOffset, mul(i, 0x20))))
        tmp := keccak256(0, 0x40)
      }

      mstore(mload(0x40), tmp)
      mstore(add(mload(0x40), 32), memHash)
      mstore(add(mload(0x40), 64), dataHash)
      mstore(add(mload(0x40), 96), i_pc)
      mstore(add(mload(0x40), 128), stackSize)
      mstore(add(mload(0x40), 160), memSize)

      // preHash
      tmp := keccak256(mload(0x40), 192)

      mstore(mload(0x40), tmp)
      mstore(add(mload(0x40), 32), 0)
      calldatacopy(add(mload(0x40), 32), returnDataOffset, returnDataLength)
      tmp := keccak256(add(mload(0x40), 32), returnDataLength)
      mstore(add(mload(0x40), 32), tmp)

      // inputHash
      tmp := keccak256(mload(0x40), 64)
      mstore(0, tmp)
      mstore(32, dataHash)
    }
    bytes32 inputHash;
    bytes32 dataHash;
    assembly {
      inputHash := mload(0)
      dataHash := mload(32)
    }

    if ((inputHash != dispute.solverLeft && inputHash != dispute.challengerLeft) ||
      ((dispute.state & START_OF_EXECUTION) != 0 && inputHash != dispute.initialStateHash)) {
      return;
    }
    if (dispute.witness != bytes32(0)) {
      if (inputHash != dispute.witness) {
        return;
      }
    }

    if ((dispute.state & END_OF_EXECUTION) != 0) {
      uint8 opcode = 0;
      assembly {
        extcodecopy(address(), 31, mload(params), 1)
        opcode := mload(0)
      }

      if (opcode != OP_REVERT && opcode != OP_RETURN && opcode != OP_STOP) {
        return;
      }
    }

    // execute it now
    uint256 errno = _executeState(params);

    if (errno != NO_ERROR && errno != ERROR_STATE_REVERTED) {
      return;
    }

    bytes32[] memory nStack;
    bytes32[] memory nMem;
    bytes32 nReturnDataHash;
    bytes32 stackSibling;

    assembly {
      nStack := mload(add(params, 96))
      nMem := mload(add(params, 128))
      let returnData := mload(add(params, 160))
      let len := mload(returnData)
      nReturnDataHash := keccak256(add(returnData, 32),  len)

      stackSibling := calldataload(68)
    }

    bytes32 newStackHash = stackHash(nStack, stackSibling);
    bytes32 newMemHash;
    // if memory was 'touched'
    if (nMem.length > 0) {
      assembly {
        let memHash := calldataload(100)
        if gt(memHash, 0) {
          // memory was touched but memory was not provided
          revert(0, 0)
        }
      }
      newMemHash = memHash(nMem);
    } else {
      assembly {
        newMemHash := calldataload(100)
      }
    }

    // stackSize cant be bigger than 1024 (stack limit)
    if (params[1] > MAX_STACK_SIZE) {
      return;
    }

    bytes32 outputHash = stateHash(
      params[0],
      params[1],
      params[2],
      newStackHash,
      newMemHash,
      dataHash,
      nReturnDataHash
    );

    if (outputHash != dispute.solverRight && outputHash != dispute.challengerRight) {
      return;
    }

    if (outputHash == dispute.solverRight) {
      dispute.state |= SOLVER_VERIFIED;
    }

    if (outputHash == dispute.challengerRight) {
      dispute.state |= CHALLENGER_VERIFIED;
    }

    bool solverWon = dispute.state & SOLVER_VERIFIED != 0;
    onDisputeResolved(disputeId, solverWon);
  }

  /// @dev When claimTimeout is called, the dispute must not be resolved
  /// Hence, there are 3 cases:
  ///  - Nobody has responded
  ///  - Solver has responded, challenger hasn't: Solver wins
  ///  - Solver has not responded, challenger has: Challenger wins
  /// The case both have responded is not exist because if both responded, updateRound would has been called
  ///  and reset timeout and states
  /// The case 'Nobody has responded' has 2 subcases:
  ///  - Before last turn: Solver wins, because we assume that challenger is the one who requested the dispute and has more responsibility
  ///  - Last turn: Challenger wins. Here, somebody should call submitProof. If it is not called, it should be solver's fault,
  ///      because it could be something only solver knows
  function claimTimeout(bytes32 disputeId) public {
    Dispute storage dispute = disputes[disputeId];

    require(dispute.timeout > 0, 'dispute not exist');
    require(dispute.timeout < block.timestamp, 'not timed out yet');
    require(
      (dispute.state & SOLVER_VERIFIED) == 0 && (dispute.state & CHALLENGER_VERIFIED) == 0,
      'already notified enforcer'
    );

    bool solverWins;

    if ((dispute.state & SOLVER_RESPONDED) != 0) {
      solverWins = true;
    } else if ((dispute.state & CHALLENGER_RESPONDED) != 0) {
      solverWins = false;
    } else {
      solverWins = (dispute.treeDepth > 0);
    }

    if (solverWins) {
      dispute.state |= SOLVER_VERIFIED;
    } else {
      dispute.state |= CHALLENGER_VERIFIED;
    }

    onDisputeResolved(disputeId, solverWins);
  }

  /// @dev refresh timeout of dispute
  function getTimeout() internal view returns (uint256) {
    return block.timestamp + timeoutDuration;
  }

  /// @dev updateRound runs every time after receiving a respond
  /// assume that both solver and challenger have the same tree depth
  // solhint-disable-next-line code-complexity, function-max-lines
  function updateRound(bytes32 disputeId, Dispute storage dispute, bytes32 witnessPathLeft, bytes32 witnessPathRight) internal {
    if ((dispute.state & SOLVER_RESPONDED) == 0 || (dispute.state & CHALLENGER_RESPONDED) == 0) {
      return;
    }

    // left can not be zero
    if (dispute.solverLeft == bytes32(0)) {
      onDisputeResolved(disputeId, false);
      dispute.state |= CHALLENGER_VERIFIED;
      return;
    }
    if (dispute.challengerLeft == bytes32(0)) {
      onDisputeResolved(disputeId, true);
      dispute.state |= SOLVER_VERIFIED;
      return;
    }

    if (dispute.witness != bytes32(0)) {
      require(
        keccak256(abi.encodePacked(witnessPathLeft, witnessPathRight)) == dispute.witness
      );

      dispute.witness = witnessPathRight;
    }

    // refresh state and timeout
    dispute.timeout = getTimeout();
    dispute.state ^= SOLVER_RESPONDED | CHALLENGER_RESPONDED;

    dispute.treeDepth -= 1;

    if ((dispute.solverLeft == dispute.challengerLeft) &&
      (dispute.solverRight != 0) &&
      (dispute.challengerRight != 0)) {
      // following right
      dispute.witness = dispute.solverLeft;
      dispute.solverPath = dispute.solverRight;
      dispute.challengerPath = dispute.challengerRight;

      if ((dispute.state & START_OF_EXECUTION) != 0) {
        dispute.state ^= START_OF_EXECUTION;
      }
    } else {
      // following left
      dispute.solverPath = dispute.solverLeft;
      dispute.challengerPath = dispute.challengerLeft;

      if (dispute.solverRight != 0) {
        if ((dispute.state & END_OF_EXECUTION) != 0) {
          dispute.state ^= END_OF_EXECUTION;
        }
      }
    }
    emit DisputeNewRound(disputeId, dispute.timeout, dispute.solverPath, dispute.challengerPath);
  }

  /// @notice Verify `returnDataHash` of the last execution step.
  /// @dev Attention: This function modifies the `_resultProof` array!
  /// @return bool `true` if correct, `false` otherwise
  function verifyResultProof(
    bytes32 _pathRoot,
    bytes32[] memory _resultProof,
    bytes32 _returnDataHash
  ) public pure returns (bool) {
    if (_resultProof.length < 2 || (_resultProof.length % 2) != 0) {
      return false;
    }

    bool valid = true;
    assembly {
      // length in bytes of _resultProof
      let len := mload(_resultProof)
      // pointer to first value in _resultProof
      let ptr := add(_resultProof, 0x20)
      // pointer to _resultProof[_resultProof.length - 2]
      let leftPtr := add(ptr, mul(sub(len, 2), 0x20))
      // pointer to _resultProof[_resultProof.length - 1]
      let rightPtr := add(leftPtr, 0x20)
      // if `right` is zero, we use `left`
      let hashRightValue := mload(rightPtr)

      if iszero(hashRightValue) {
        // hash left
        mstore(0, mload(leftPtr))
      }
      if gt(hashRightValue, 0) {
        // hash right
        mstore(0, hashRightValue)
      }
      mstore(32, _returnDataHash)
      // the stateHash for the last leaf
      let stateHash := keccak256(0, 64)

      // store the updated value into `_resultProof`
      if iszero(hashRightValue) {
        mstore(leftPtr, stateHash)
      }
      if gt(hashRightValue, 0) {
        mstore(rightPtr, stateHash)
      }

      let parentHash := _pathRoot
      for { let i := 0 } lt(i, len) { i := add(i, 2) } {
        let left := add(ptr, mul(i, 0x20))
        let rightVal := mload(add(left, 0x20))
        let nodeHash := keccak256(left, 0x40)

        if iszero(eq(nodeHash, parentHash)) {
          // invalid
          valid := 0
          // end loop
          len := 0
        }

        // we default to take the `right` path
        parentHash := rightVal
        // unless if it is zero, we go `left`
        if eq(rightVal, 0) {
          parentHash := mload(left)
        }
      }
    }

    return valid;
  }
}
