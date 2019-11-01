pragma solidity ^0.5.2;

import './Replayer.sol';
import './Verifier.sol';

// TODO: investigate possible re-entrancy attacks
contract Bridge is Replayer, Verifier {
  uint16 public constant version = 1;
  uint256 public constant MAX_BLOCK_SIZE = 8096;
  uint256 public constant MAX_SOLUTION_SIZE = 8096;
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
  // blockNumber > deposit witness
  mapping (uint256 => bytes32) depositWitness;
  // array of solutionHashes
  bytes32[] blockSolutions;
  // array of disputeIds
  bytes32[] blockDisputes;

  // TODO: get rid of these storage patterns
  // solutionHash > pathRoot
  mapping (bytes32 => bytes32) pathRootOfSolution;
  // solutionHash > execution depth
  mapping (bytes32 => uint256) treeDepthOfSolution;
  // solutionHash > timeOfSubmission | in blocks
  mapping (bytes32 => uint256) public timeOfSubmission;
  // solutionHash > submitter/solver
  mapping (bytes32 => address) solverOfSolution;
  // solutionHash > open disputes
  mapping (bytes32 => uint256) openDisputeCount;
  // disputeId > solutionHash
  mapping (bytes32 => bytes32) solutionOfDispute;
  // disputeId > challenger
  mapping (bytes32 => address) challengerOfDispute;

  event Deposit(address token, address owner, uint256 value);
  event BlockBeacon();
  event NewSolution(bytes32 blockHash, bytes32 solutionHash, bytes32 pathRoot, uint256 depth);
  event NewDispute(bytes32 blockHash, bytes32 solverPath, bytes32 challengerPath, bytes32 disputeId);
  event Slashed(bytes32 id, bool solverWon);

  constructor () public {
    createdAtBlock = block.number;
  }

  /// @dev Deposit `token` and value (`amountOrId`) into bridge.
  /// Only the ERC20 standard is supported for now.
  function deposit (address token, uint256 amountOrId, bytes20[] memory depositProof) public {
    uint256 blockNumber = currentBlock + 1;
    bytes32 expectedHash = depositWitness[blockNumber];

    if (expectedHash != bytes32(0)) {
      bytes32 hash;
      uint len = depositProof.length * 20;
      assembly {
        hash := keccak256(add(depositProof, 32), len)
      }

      if (hash != expectedHash) {
        revert();
      }

      for (uint256 i = 0; i < depositProof.length; i++) {
        if (address(depositProof[i]) == msg.sender) {
          // user can not deposit until the next block is finished
          revert();
        }
      }
    }

    // TODO: check for zero amountOrId?
    assembly {
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

    // a deposit increases the allowance value from bridge for caller (ERC20)
    // TODO: check for overflow?
    uint256 oldVal = getAllowanceValue(token, address(this), msg.sender);
    setAllowanceValue(token, address(this), msg.sender, oldVal + amountOrId);

    emit Deposit(token, msg.sender, amountOrId);
  }

  /// @dev Withdraw `token` and `amountOrId` from bridge.
  /// `tokenId` is a placeholder until we support ERC721.
  function withdraw (address token, uint256 tokenId) public {
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
  function submitBlock () public {
    bytes32 blockHash;
    assembly {
      let tmp := mload(0x40)
      let size := sub(calldatasize, 4)
      // MAX_BLOCK_SIZE
      if gt(size, 8096) {
        revert(0, 0)
      }
      mstore(0, 0x64ef39ca00000000000000000000000000000000000000000000000000000000)
      //mstore(4, size)
      calldatacopy(4, 4, size)
      blockHash := keccak256(0, add(size, 4))
      mstore(0x40, tmp)
      mstore(0x60, 0)
    }

    uint256 pending = highestPendingBlock + 1;
    blocks[blockHash] = pending;
    highestPendingBlock = pending;

    emit BlockBeacon();

    uint256[5] memory params;
    uint256 offset = 4;
    uint256 length;
    assembly {
      length := calldatasize()
    }

    uint256 start;
    assembly {
      let p := mload(0x40)
      start := p
      mstore(0x40, add(p, 32))
    }

    while (offset < length) {
      offset = parseTx(offset, length, params);
      address from = address(params[0]);
      uint256 calldataoffset = params[3];
      uint256 calldatalength = params[4];

      assembly {
        let funcSig := shr(224, calldataload(calldataoffset))
        // transferFrom
        if eq(funcSig, 0x23b872dd) {
          let f := calldataload(add(calldataoffset, 4))
          if eq(f, address()) {
            // Drains from the bridge,
            // we only support that from the msgSender.
            // assume to = msgSender even if the data might contain something different (malformed)
            // from = ecrecover'ed transaction sender
            let ptr := mload(0x40)
            mstore(ptr, shl(96, from))
            mstore(0x40, add(ptr,  20))
          }
        }
      }
    }

    bytes32 witness;
    assembly {
      let len := sub(mload(0x40), add(start,  32))
      witness := keccak256(add(start, 32), len)
    }

    depositWitness[pending] = witness;
  }

  /// @dev Checks if `blockHash` is the current block that needs finalization.
  function _isCurrentBlock (bytes32 blockHash) internal returns (bool) {
    uint256 cblock = currentBlock + 1;
    if (blocks[blockHash] != cblock) {
      return false;
    }

    return true;
  }

  /// @dev Internal function to check if caller satisfies common conditions.
  function _disputeCheck (bytes32 blockHash) internal {
    if (msg.value != BOND_AMOUNT) {
      revert();
    }

    uint256 cblock = currentBlock + 1;
    if (blocks[blockHash] != cblock) {
      revert();
    }
  }

  /// @dev Register solution given `blockHash`.
  /// Triggers INSPECTION_PERIOD in number of root blocks
  function submitSolution (
    bytes32 blockHash,
    bytes32 solutionHash,
    bytes32 pathRoot,
    uint256 executionDepth,
    bytes32[] memory resultProof
  ) public payable
  {
    _disputeCheck(blockHash);
    require(timeOfSubmission[solutionHash] == 0);
    // TODO: guard against the case that the solution was submitted twice and deleted

    // verify that `solutionHash` is indeed the return value from last execution step
    require(verifyResultProof(pathRoot, resultProof, solutionHash) == true, 'invalid resultProof');

    bytes32[] storage sols = blockSolutions;
    sols.push(solutionHash);

    pathRootOfSolution[solutionHash] = pathRoot;
    treeDepthOfSolution[solutionHash] = executionDepth;
    timeOfSubmission[solutionHash] = block.number;
    solverOfSolution[solutionHash] = msg.sender;

    emit NewSolution(blockHash, solutionHash, pathRoot, executionDepth);
  }

  /// @dev Challenge a solution
  function dispute (bytes32 blockHash, bytes32 solutionHash, bytes32 pathRoot) public payable {
    _disputeCheck(blockHash);

    uint256 time = timeOfSubmission[solutionHash];
    // Revert if the solution does not exist or already over the inspection period.
    if (time == 0 || block.number > time + INSPECTION_PERIOD) {
      revert();
    }

    bytes32 solverPathRoot = pathRootOfSolution[solutionHash];
    uint256 executionDepth = treeDepthOfSolution[solutionHash];

    bytes32 disputeId = initGame(
      // solver
      solverPathRoot,
      // challenger
      pathRoot,
      executionDepth,
      // dataHash
      blockHash
    );
    blockDisputes.push(disputeId);

    challengerOfDispute[disputeId] = msg.sender;
    solutionOfDispute[disputeId] = solutionHash;
    openDisputeCount[solutionHash] += 1;

    emit NewDispute(blockHash, solverPathRoot, pathRoot, disputeId);
  }

  /// @dev The `Verifier`-part calls this to execute the given step
  function _executeState (uint256[11] memory params) internal returns (uint256 errno) {
    EVM memory evm;

    // setup EVM
    codeFromAddress(evm, address(this));
    evm.memSize = params[2];
    evm.callDataLength = params[3];
    evm.callDataOffset = params[4];

    // stack limit to 64 slots
    stackFromCalldata(evm, params[5], params[6], 64);
    memFromCalldata(evm, params[7], params[8]);
    evm.returnData = arrayFromCalldata(params[9], params[10]);

    // run one step at pc(params[0])
    _run(evm, params[0], 1);

    // get returnData, stack, mem
    bytes memory rData = evm.returnData;
    bytes32[] memory stack = stackToArray(evm);
    bytes32[] memory mem;

    if (evm.memSize > 0) {
      mem = memToArray(evm);
    }

    // (totalStackSize - submitted stack values) + stackSize after execution
    uint stackSize = (params[1] - params[5]) + evm.stackSize;
    params[1] = stackSize;
    params[0] = evm.pc;
    params[2] = evm.memSize;

    // store references into `params`
    assembly {
      mstore(add(params, 96), stack)
      mstore(add(params, 128), mem)
      mstore(add(params, 160), rData)
    }

    return evm.errno;
  }

  function _deleteSolution (bytes32 solutionHash) internal {
    delete pathRootOfSolution[solutionHash];
    delete treeDepthOfSolution[solutionHash];
    delete timeOfSubmission[solutionHash];
    delete solverOfSolution[solutionHash];
    delete openDisputeCount[solutionHash];
  }

  function _deleteDispute (bytes32 disputeId) internal {
    delete solutionOfDispute[disputeId];
    delete challengerOfDispute[disputeId];
    delete disputes[disputeId];
  }

  function _deleteAllSolutionsAndReturnBonds () internal {
    for (uint256 i = 0; i < blockSolutions.length; i++) {
      bytes32 solutionHash = blockSolutions[i];
      address payable solver = address(bytes20(solverOfSolution[solutionHash]));

      if (solver != address(0)) {
        solver.transfer(BOND_AMOUNT);
        _deleteSolution(solutionHash);
      }
    }
    delete blockSolutions;
  }

  function _deleteAllDisputesAndReturnBonds () internal {
    for (uint256 i = 0; i < blockDisputes.length; i++) {
      bytes32 disputeId = blockDisputes[i];

      address payable challenger = address(bytes20(challengerOfDispute[disputeId]));
      // it is possible that this dispute was already deleted
      if (challenger != address(0)) {
        challenger.transfer(BOND_AMOUNT);
        _deleteDispute(disputeId);
      }
    }
    delete blockDisputes;
  }

  /// @dev Callback from the Verifier once a dispute is resolved
  function onDisputeResolved (
    bytes32 disputeId,
    bool solverWon
  ) internal
  {
    // If the solution is deleted by some other resolved dispute
    // - Only return challenger's bond
    bytes32 solutionHash = solutionOfDispute[disputeId];
    address payable solver = address(bytes20(solverOfSolution[solutionHash]));

    // already deleted
    if (solver == address(0)) {
      // return challenger's bond
      address payable challenger = address(bytes20(challengerOfDispute[disputeId]));
      challenger.transfer(BOND_AMOUNT);
    } else {
      if (solverWon) {
        // solver gets bond
        solver.transfer(BOND_AMOUNT);
        openDisputeCount[solutionHash] -= 1;
      } else {
        // challenger gets bond * 2 (challenger's + solver's bond)
        address payable challenger = address(bytes20(challengerOfDispute[disputeId]));
        challenger.transfer(BOND_AMOUNT * 2);
        // solution must be deleted
        _deleteSolution(solutionHash);
      }
    }

    _deleteDispute(disputeId);

    emit Slashed(disputeId, solverWon);
  }

  /// @dev Returns true if `solutionHash` can be finalized, else false.
  function canFinalizeSolution (bytes32 solutionHash) public view returns (bool) {
    bytes32[] storage sols = blockSolutions;
    bytes32 oldestSol;
    uint256 oldestv = block.number;

    for (uint256 i = 0; i < sols.length; i++) {
      bytes32 v = sols[i];
      uint256 time = timeOfSubmission[v];
      // time > 0 ; checks that the solution still exists
      if (time > 0 && time < oldestv) {
        oldestv = time;
        oldestSol = v;
      }
    }

    if (oldestSol == 0 || oldestSol != solutionHash) {
      return false;
    }
    // solution too young
    if (block.number <= (timeOfSubmission[solutionHash] + INSPECTION_PERIOD)) {
      return false;
    }
    // if there are still open challenges
    if (openDisputeCount[solutionHash] != 0) {
      return false;
    }

    return true;
  }

  /// @dev Finalize the oldest solution alive and move to the next block.
  /// Solution must be past the `INSPECTION_PERIOD`.
  function finalizeSolution (bytes32 blockHash, bytes calldata) external {
    uint256 cblock = currentBlock + 1;

    if (blocks[blockHash] != cblock) {
      revert();
    }

    currentBlock = cblock;
    delete blocks[blockHash];
    delete depositWitness[cblock - 1];

    bytes32 solutionHash;
    assembly {
      let size := sub(calldatasize, 100)
      // MAX_SOLUTION_SIZE
      if gt(size, 8096) {
        revert(0, 0)
      }
      calldatacopy(0x80, 100, size)
      solutionHash := keccak256(0x80, size)
    }

    if (!canFinalizeSolution(solutionHash)) {
      revert();
    }

    _deleteAllDisputesAndReturnBonds();

    address payable solver = address(bytes20(solverOfSolution[solutionHash]));
    // now delete all solutions and references
    for (uint256 i = 0; i < blockSolutions.length; i++) {
      bytes32 v = blockSolutions[i];
      _deleteSolution(v);
    }
    delete blockSolutions;

    // Winner gets all remaining bonds from the open solutions.
    uint256 bonds = address(this).balance;
    solver.transfer(bonds);

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

  function offroadReplay () external {
    _replay();

    assembly {
      let end := 0x80
      // storage {key, value}
      for { let i := 0x80 } lt(i, 0x880) { i := add(i, 0x40) } {
        let key := mload(i)

        if iszero(key) {
          end := i
          i := 0xffff
        }
      }

      let len := sub(end, 0x80)
      return(0x80, len)
    }
  }

  /// @dev direct replay the next pending block
  function replay () public {
    // validate the data
    bytes32 blockHash;
    assembly {
      let tmp := mload(0x40)
      let len := sub(calldatasize, 4)
      mstore(0, 0x64ef39ca00000000000000000000000000000000000000000000000000000000)
      calldatacopy(4, 4, len)
      blockHash := keccak256(0, add(len, 4))
      mstore(0x40, tmp)
      mstore(0x60, 0)
    }

    uint256 cblock = currentBlock + 1;
    if (blocks[blockHash] != cblock) {
      revert();
    }
    currentBlock = cblock;
    delete blocks[blockHash];
    delete depositWitness[cblock - 1];

    _deleteAllDisputesAndReturnBonds();
    _deleteAllSolutionsAndReturnBonds();

    assembly {
      // zero the memory for our in-memory storage region
      for { let i := 0x80 } lt(i, 0x880) { i := add(i, 0x20) } {
        mstore(i, 0)
      }
    }

    _replay();

    assembly {
      // storage {key, value}
      for { let i := 0x80 } lt(i, 0x880) { i := add(i, 0x40) } {
        let key := mload(i)
        let value := mload(add(i, 0x20))

        if iszero(key) {
          i := 0xffff
        }

        if gt(key, 0) {
          sstore(key, value)
        }
      }
    }
  }
}
