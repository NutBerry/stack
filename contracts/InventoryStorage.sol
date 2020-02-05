pragma solidity ^0.5.2;

// TODO
// once we use state-roots, investigate if decoupling the temporay
// storage mechanism into another contract makes sense.
contract InventoryStorage {
  function _getStorage (bytes32 target) internal view returns (uint256 v) {
    assembly {
      v := sload(target)
    }
  }

  function _setStorage (bytes32 target, uint256 value) internal {
    assembly {
      sstore(target, value)
    }
  }

  function _incrementStorage (bytes32 target, uint256 value) internal {
    assembly {
      let v := sload(target)
      sstore(target, add(v, value))
    }
  }

  function _hashERC20Exit (address target, address owner) internal pure returns (bytes32 ret) {
    assembly {
      mstore(0, or(shl(64, owner), shl(224, 0x0001)))
      mstore(24, shl(96, target))
      ret := keccak256(0, 44)
    }
  }

  function _hashERC721Exit (address target, uint256 tokenId) internal pure returns (bytes32 ret) {
    assembly {
      mstore(0, or(shl(64, target), shl(224, 0x0001)))
      mstore(24, tokenId)
      ret := keccak256(0, 56)
    }
  }

  function _hashERC20 (address target, address owner) internal pure returns (bytes32 ret) {
    assembly {
      mstore(0, or(shl(64, target), shl(224, 0x0002)))
      mstore(24, shl(96, owner))
      ret := keccak256(0, 44)
    }
  }

  function _hashERC721 (address target, uint256 tokenId) internal pure returns (bytes32 ret) {
    assembly {
      mstore(0, or(shl(64, target), shl(224, 0x0005)))
      mstore(24, tokenId)
      ret := keccak256(0, 56)
    }
  }

  function _hashAllowance (address target, address owner, address spender) internal pure returns (bytes32 ret) {
    assembly {
      mstore(0, or(shl(64, target), shl(224, 0x0003)))
      mstore(24, shl(96, owner))
      // we overwrite parts of the freeMemPtr, but this is not a problem because the
      // memPtr would never be that high and we overwrite only 12 bytes (zeros) :)
      mstore(44, shl(96, spender))
      ret := keccak256(0, 64)
    }
  }

  function _hashApproval (address target, uint256 tokenId) internal pure returns (bytes32 ret) {
    assembly {
      mstore(0, or(shl(64, target), shl(224, 0x0004)))
      mstore(24, tokenId)
      ret := keccak256(0, 56)
    }
  }

  function _incrementExit (address target, address owner, uint256 value) internal {
    _incrementStorage(_hashERC20Exit(target, owner), value);
  }

  function getExit (address target, address owner) public view returns (uint256) {
    return _getStorage(_hashERC20Exit(target, owner));
  }

  function _setExit (address target, address owner, uint256 value) internal {
    _setStorage(_hashERC20Exit(target, owner), value);
  }

  function getERC721Exit (address target, uint256 tokenId) public view returns (address) {
    return address(_getStorage(_hashERC721Exit(target, tokenId)));
  }

  function _setERC721Exit (address target, address owner, uint256 tokenId) internal {
    _setStorage(_hashERC721Exit(target, tokenId), uint256(owner));
  }
}
