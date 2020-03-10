pragma solidity ^0.6.2;

import './_Bridge.sol';
import './LEVM.sol';

contract Bridge is _Bridge, LEVM {
  constructor () public {
    createdAtBlock = block.number;
  }

  /// @dev Deposit `token` and value (`amountOrId`) into bridge.
  /// @param token The ERC20/ERC721 token address.
  /// @param amountOrId Amount or the token id.
  function deposit (address token, uint256 amountOrId) public {
    // TODO: check for zero amountOrId?

    uint256 pending = pendingHeight + 1;
    pendingHeight = pending;

    bytes32 blockHash;
    assembly {
      // our deposit block
      // 32 bytes nonce
      mstore(0x80, pending)
      // 20 byte caller
      mstore(0xa0, shl(96, caller()))
      // 20 byte token
      mstore(0xb4, shl(96, token))
      // 32 byte amount or token id
      mstore(0xc8, amountOrId)
      blockHash := keccak256(0x80, 104)
    }

    blocks[pending] = blockHash;
    emit Deposit(token, msg.sender, amountOrId);

    bool isNFT = isERC721(token, amountOrId);
    assembly {
      // transferFrom
      let sig := shl(224, 0x23b872dd)
      mstore(0x80, sig)
      mstore(0x84, caller())
      mstore(0xa4, address())
      mstore(0xc4, amountOrId)
      let success := call(gas(), token, 0, 0x80, 0x64, 0, 32)
      if iszero(success) {
        revert(0, 0)
      }
      if iszero(isNFT) {
        if iszero(mload(0)) {
          revert(0, 0)
        }
      }
    }
  }

  /// @dev Withdraw `token` and `tokenId` from bridge.
  /// `tokenId` is ignored if `token` is not a ERC721.
  /// @param token address of the token.
  /// @param tokenId ERC721 token id.
  function withdraw (address token, uint256 tokenId) public {
    uint256 val;

    if (isERC721(token, tokenId)) {
      address owner = getERC721Exit(token, tokenId);
      if (owner == address(0) || owner != msg.sender) {
        revert();
      }
      val = tokenId;
      _setERC721Exit(token, address(0), val);
    } else {
      val = getERC20Exit(token, msg.sender);
      _setERC20Exit(token, msg.sender, 0);
    }

    assembly {
      let sig := shl(224, 0x23b872dd)
      mstore(0x80, sig)
      mstore(0x84, address())
      mstore(0xa4, caller())
      mstore(0xc4, val)
      let success := call(gas(), token, 0, 0x80, 0x64, 0, 0)
      if iszero(success) {
        revert(0, 0)
      }
    }
  }

  /// @dev Submit a transaction blob (a block).
  /// The block-data is expected right after the 4-byte function signature.
  /// Only regular accounts are allowed to submit blocks.
  function submitBlock () public payable {
    _checkCaller();

    // Submitting special blocks like deposits-blocks is not allowed.
    // Revert if someone is trying to submit such a block.
    if (_isSpecialBlock()) {
      revert();
    }

    uint256 pending = pendingHeight + 1;
    bytes32 blockHash = _blockHash(pending);
    blocks[pending] = blockHash;
    pendingHeight = pending;

    emit BlockBeacon();
  }

  /// @dev Register solution for given `blockNumber`.
  /// Up to 256 solutions can be registered ahead in time.
  function submitSolution (
    uint256 blockNumber,
    bytes32 solutionHash
  ) public {
    uint256 tmp = finalizedHeight;

    require(blockNumber > tmp);
    require(blockNumber <= tmp + 256);
    require(solutionHash != 0);
    require(solutionHash != bytes32(uint256(-1)));
    require(blocks[blockNumber] != 0);
    require(blockSolutions[blockNumber] == 0);

    blockSolutions[blockNumber] = solutionHash;
    timeOfSubmission[blockNumber] = block.number;

    emit NewSolution(blockNumber, solutionHash);
  }

  /// @dev Flag a solution.
  function dispute (uint256 blockNumber) public {
    uint256 tmp = finalizedHeight;

    require(blockNumber > tmp);
    require(blockNumber <= tmp + 256);
    require(blockSolutions[blockNumber] != 0);

    blockSolutions[blockNumber] = bytes32(uint256(-1));
  }

  /// @dev Challenge the solution or just verify the next pending block directly.
  function challenge () public {
    // validate the block-data
    uint256 blockNumber = finalizedHeight + 1;
    bytes32 blockHash = _blockHash(blockNumber);
    require(blocks[blockNumber] == blockHash);

    uint256 offsetStart = challengeOffset;
    if (offsetStart == 0) {
      // function sig
      offsetStart = 4;
    }

    (bool complete, uint256 nextOffset) = _validateBlock(offsetStart);

    if (complete) {
      // if we are done, finalize this block
      _resolveBlock(blockNumber);
      return;
    }

    challengeOffset = nextOffset;
  }

  /// @dev Returns true if `blockNumber` can be finalized, else false.
  function canFinalizeBlock (uint256 blockNumber) public view returns (bool) {
    if (blockNumber != finalizedHeight + 1) {
      return false;
    }

    uint256 time = timeOfSubmission[blockNumber];
    // solution too young
    if (time == 0 || block.number <= (time + INSPECTION_PERIOD)) {
      return false;
    }

    // got disputed?
    if (blockSolutions[blockNumber] == bytes32(uint256(-1))) {
      return false;
    }

    // if there is no active challenge, then yes
    return challengeOffset == 0;
  }

  /// @dev Finalize solution and move to the next block.
  /// Solution must not be bigger than `MAX_SOLUTION_SIZE`.
  /// `canFinalizeBlock` must return true for `blockNumber`.
  function finalizeSolution (uint256 blockNumber) external {
    bytes32 solutionHash;
    assembly {
      let size := sub(calldatasize(), 36)
      // MAX_SOLUTION_SIZE
      if gt(size, 8192) {
        revert(0, 0)
      }
      calldatacopy(0x80, 36, size)
      solutionHash := keccak256(0x80, size)
    }

    require(solutionHash == blockSolutions[blockNumber]);

    if (!canFinalizeBlock(blockNumber)) {
      revert();
    }

    _resolveBlock(blockNumber);

    // update our storage
    assembly {
      for { let ptr := 36 } lt(ptr, calldatasize()) { } {
        let key := calldataload(ptr)
        ptr := add(ptr, 32)
        let prefix := byte(0, calldataload(ptr))
        ptr := add(ptr, 1)
        let val := calldataload(ptr)
        ptr := add(ptr, 32)

        if lt(key, 0xffff) {
          revert(0, 0)
        }
        if iszero(prefix) {
          val := add(val, sload(key))
        }
        sstore(key, val)
      }
    }
  }
}
