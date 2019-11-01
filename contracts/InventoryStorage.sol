pragma solidity ^0.5.2;

contract InventoryStorage {
  function _getStorage (bytes32 target) internal view returns (uint256) {
    uint256 rvalue;
    uint ok = 1;

    assembly {
      let size := 0x800

      for { let i := 0x80 } lt(i, size) { i := add(i, 0x40) } {

        let t := mload(i)

        if eq(t, target) {
          rvalue := mload(add(i, 0x20))
          ok := 0
        }

        if iszero(t) {
          i := 0xffff
        }
        if iszero(ok) {
          i := 0xffff
        }
      }
    }

    if (ok == 1) {
      assembly {
        rvalue := sload(target)
      }
    }

    return rvalue;
  }

  function _setStorage (bytes32 target, uint256 value) internal {
    assembly {
      let size := 0x800

      for { let i := 0x80 } lt(i, size) { i := add(i, 0x40) } {
        let t := mload(i)

        if eq(target, t) {
          mstore(add(i, 0x20), value)
          i := 0xffff
          t := 1
        }

        if iszero(t) {
          mstore(i, target)
          mstore(add(i, 0x20), value)

          i := 0xffff
        }
      }
    }
  }

  function _incrementStorage (bytes32 target, uint256 value) internal {
    assembly {
      let size := 0x800

      for { let i := 0x80 } lt(i, size) { i := add(i, 0x40) } {
        let t := mload(i)

        if eq(target, t) {
          mstore(add(i, 0x20), add(value, mload(add(i, 0x20))))
          i := 0xffff
          t := 1
        }

        if iszero(t) {
          mstore(i, target)
          mstore(add(i, 0x20), value)

          i := 0xffff
        }
      }
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
      mstore(44, shl(96, spender))
      ret := keccak256(0, 64)
    }
  }

  function incrementExit (address target, address owner, uint256 value) internal {
    _incrementStorage(_hashExit(target, owner), value);
  }

  function getAllowanceValue (address target, address owner, address spender) public view returns (uint256 ret) {
    bytes32 key = _hashAllowance(target, owner, spender);
    assembly {
      ret := sload(key)
    }
  }

  function setAllowanceValue (address target, address owner, address spender, uint256 value) internal {
    bytes32 key = _hashAllowance(target, owner, spender);
    assembly {
      sstore(key, value)
    }
  }

  function getAllowance (address target, address owner, address spender) public view returns (uint256) {
    return _getStorage(_hashAllowance(target, owner, spender));
  }

  function setAllowance (address target, address owner, address spender, uint256 value) internal {
    _setStorage(_hashAllowance(target, owner, spender), value);
  }

  function getERC20 (address target, address owner) internal returns (uint256) {
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

  function getExit (address target, address owner) public view returns (uint256) {
    return _getStorage(_hashExit(target, owner));
  }

  function setExit (address target, address owner, uint256 value) internal {
    _setStorage(_hashExit(target, owner), value);
  }

  function getNonce (address target) public view returns (uint256) {
    return _getStorage(_hashNonce(target));
  }

  function setNonce (address target, uint256 value) internal {
    _setStorage(_hashNonce(target), value);
  }
}
