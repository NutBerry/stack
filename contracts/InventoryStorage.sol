pragma solidity ^0.5.2;

contract InventoryStorage {
  function _getStorage (bytes32 target) internal view returns (uint256) {
    uint256 v;
    assembly {
      v := sload(target)
    }
    return v;
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

  function _hashExit (address target, address owner) internal pure returns (bytes32 ret) {
    assembly {
      mstore(0, or(shl(64, owner), shl(224, 0x0001)))
      mstore(24, shl(96, target))
      ret := keccak256(0, 44)
    }
  }

  function _hashNonce (address target) internal pure returns (bytes32 ret) {
    assembly {
      ret := target
    }
  }

  function _hashERC20 (address target, address owner) internal pure returns (bytes32 ret) {
    assembly {
      mstore(0, or(shl(64, target), shl(224, 0x0002)))
      mstore(24, shl(96, owner))
      ret := keccak256(0, 44)
    }
  }

  function _hashAllowance (address target, address owner, address spender) internal pure returns (bytes32 ret) {
    assembly {
      mstore(0, or(shl(64, target), shl(224, 0x0003)))
      mstore(24, shl(96, owner))
      // we overwrite parts of the freeMemPtr, but this is not a problem because the
      // memPtr would never be that high and we overwrite only 12 bytes :)
      mstore(44, shl(96, spender))
      ret := keccak256(0, 64)
    }
  }

  function incrementExit (address target, address owner, uint256 value) internal {
    _incrementStorage(_hashExit(target, owner), value);
  }

  function getAllowance (address target, address owner, address spender) internal view returns (uint256) {
    return _getStorage(_hashAllowance(target, owner, spender));
  }

  function setAllowance (address target, address owner, address spender, uint256 value) internal {
    _setStorage(_hashAllowance(target, owner, spender), value);
  }

  function getERC20 (address target, address owner) internal view returns (uint256) {
    return _getStorage(_hashERC20(target, owner));
  }

  function setERC20 (address target, address owner, uint256 value) internal {
    _setStorage(_hashERC20(target, owner), value);
  }

  function getExitValue (address target, address owner) public view returns (uint256 ret) {
    bytes32 key = _hashExit(target, owner);
    assembly {
      ret := sload(key)
    }
  }

  function setExitValue (address target, address owner, uint256 value) internal {
    bytes32 key = _hashExit(target, owner);
    assembly {
      sstore(key, value)
    }
  }

  function getExit (address target, address owner) internal view returns (uint256) {
    return _getStorage(_hashExit(target, owner));
  }

  function setExit (address target, address owner, uint256 value) internal {
    _setStorage(_hashExit(target, owner), value);
  }

  function getNonce (address target) internal view returns (uint256) {
    return _getStorage(_hashNonce(target));
  }

  function setNonce (address target, uint256 value) internal {
    _setStorage(_hashNonce(target), value);
  }
}
