pragma solidity ^0.6.2;

import './Inventory.sol';
import './Utils.sol';

contract LEVM is Inventory, Utils {
  // needs to be replaced with the deployed address
  address constant GATED_COMPUTING_ADDRESS = 0xabCDeF0123456789AbcdEf0123456789aBCDEF01;

  // Note, we only use the last 3 bytes instead of 4
  // the cut the first byte of the function sig
  // because that's used as a overwrite-byte in
  // GatedComputing
  uint256 constant internal FUNC_SIG_BALANCE_OF = 0xa08231;
  uint256 constant internal FUNC_SIG_APPROVE = 0x5ea7b3;
  uint256 constant internal FUNC_SIG_ALLOWANCE = 0x62ed3e;
  uint256 constant internal FUNC_SIG_TRANSFER = 0x059cbb;
  uint256 constant internal FUNC_SIG_TRANSFER_FROM = 0xb872dd;
  uint256 constant internal FUNC_SIG_OWNER_OF = 0x52211e;
  uint256 constant internal FUNC_SIG_GET_APPROVED = 0x1812fc;

  function _loadFrom () internal returns (address v) {
    assembly {
      v := sload(0xf0)
    }
  }

  function _loadTo () internal returns (address v) {
    assembly {
      v := sload(0xf2)
    }
  }

  function _arg1 () internal returns (uint256 v) {
    assembly {
      v := calldataload(4)
    }
  }

  function _arg2 () internal returns (uint256 v) {
    assembly {
      v := calldataload(36)
    }
  }

  function _arg3 () internal returns (uint256 v) {
    assembly {
      v := calldataload(68)
    }
  }

  function _returnValue (uint256 v) internal {
    assembly {
      mstore(0, v)
      return(0, 32)
    }
  }

  function _revertOnFailure (uint256 v) internal {
    assembly {
      mstore(0, v)
      if iszero(v) {
        revert(0, 32)
      }
      return(0, 32)
    }
  }

  fallback () external {
    uint256 functionSig;
    assembly {
      functionSig := shr(224, calldataload(0))
    }

    if (functionSig == FUNC_SIG_BALANCE_OF) {
      _returnValue(_balanceOf(_loadTo(), address(_arg1())));
    }

    if (functionSig == FUNC_SIG_ALLOWANCE) {
      _returnValue(_allowance(_loadTo(), address(_arg1()), address(_arg2())));
    }

    if (functionSig == FUNC_SIG_OWNER_OF) {
      _returnValue(_getStorage(_hashERC721(_loadTo(), _arg1())));
    }

    if (functionSig == FUNC_SIG_GET_APPROVED) {
      _returnValue(_getStorage(_hashApproval(_loadTo(), _arg1())));
    }

    if (functionSig == FUNC_SIG_APPROVE) {
      _revertOnFailure(_approve(_loadFrom(), _loadTo(), address(_arg1()), _arg2()));
    }

    if (functionSig == FUNC_SIG_TRANSFER) {
      _revertOnFailure(_transfer(_loadFrom(), _loadTo(), address(_arg1()), _arg2()));
    }

    if (functionSig == FUNC_SIG_TRANSFER_FROM) {
      _revertOnFailure(_transferFrom(_loadFrom(), _loadTo(), address(_arg1()), address(_arg2()), _arg3()));
    }

    assembly {
      revert(0, 0)
    }
  }

  function _checkGasLimit () internal {
    assembly {
      let limit := div(mul(gaslimit(), 10), 12)

      if lt(gas(), limit) {
        revert(0, 0)
      }
    }
  }

  /// @dev Deploy a patched version of `target` and call the contract with `callData`.
  function _deployAndCall (address gated, address target, bytes memory callData) internal returns (bool) {
    _checkGasLimit();

    bool success;

    assembly {
      let memPtr := mload(0x40)
      let codeSize := extcodesize(target)

      extcodecopy(target, memPtr, 0, codeSize)

      success := call(gas(), gated, 0, memPtr, codeSize, 12,  20)
      if eq(success, 1) {
        let patchedAddress := mload(0)
        // call the patched contract
        success := callcode(gas(), patchedAddress, 0, add(callData, 32), mload(callData), 0,  0)
      }
    }

    return success;
  }

  /// @dev Internal function for executing(replay) transactions.
  function _validateBlock (uint256 offset) internal returns (bool, uint256) {
    // a deposit-block
    if (_isSpecialBlock()) {
      address token;
      address owner;
      uint256 value;
      assembly {
        owner := shr(96, calldataload(4))
        token := shr(96, calldataload(24))
        value := calldataload(44)
      }

      if (isERC721(token, value)) {
        _setStorage(_hashERC721(token, value), uint256(owner));
      } else {
        // Do not care if `newValue` wraps around (malicious ERC20).
        bytes32 receiverKey = _hashERC20(token, owner);
        uint256 newValue = _getStorage(receiverKey) + value;
        _setStorage(receiverKey, newValue);
      }

      return (true, 0);
    }

    uint256[5] memory params;
    offset = _parseTransaction(offset, params);

    bool done;
    assembly {
      done := gt(add(offset, 1), calldatasize())
    }

    address from = address(uint160(params[0]));
    if (from == address(0)) {
      // invalid sig
      return (done, offset);
    }

    address to = address(uint160(params[1]));
    uint256 nonce = params[2];
    uint256 calldataOffset = params[3];
    uint256 calldataLength = params[4];

    // skip if the transaction nonce is not the expected one.
    if (nonce != _getStorage(bytes32(uint256(from)))) {
      return (done, offset);
    }
    _setStorage(bytes32(uint256(from)), nonce + 1);

    assembly {
      // zero
      calldatacopy(params, calldatasize(), 128)
      // copy up to 100 bytes
      let len := calldataLength
      if gt(len, 100) {
        len := 100
      }
      calldatacopy(add(params, 28), calldataOffset, len)
    }

    uint256 functionSig = params[0] & 0xffffff;
    if (functionSig == FUNC_SIG_APPROVE) {
      address spender = address(uint160(params[1]));
      uint256 value = params[2];

      _approve(from, to, spender, value);

    } else if (functionSig == FUNC_SIG_TRANSFER) {
      address _to = address(uint160(params[1]));
      uint256 value = params[2];

      _transfer(from, to, _to, value);

    } else if (functionSig == FUNC_SIG_TRANSFER_FROM) {
      address _from = address(uint160(params[1]));
      address _to = address(uint160(params[2]));
      uint256 tokenId = params[3];

      _transferFrom(from, to, _from, _to, tokenId);

    } else if (
      functionSig == FUNC_SIG_BALANCE_OF ||
      functionSig == FUNC_SIG_ALLOWANCE ||
      functionSig == FUNC_SIG_OWNER_OF ||
      functionSig == FUNC_SIG_GET_APPROVED
    ) {
      // do nothing
    } else {
      bytes memory c = new bytes(calldataLength);
      assembly {
        calldatacopy(add(c, 32), calldataOffset, calldataLength)
        // store our address to be used by the patched contract
        sstore(0xf0, to)
        sstore(0xf1, from)
      }
      // state is reverted if the contract reverts
      _deployAndCall(GATED_COMPUTING_ADDRESS, to, c);
      assembly {
        // reset slots
        sstore(0xf0, 0)
        sstore(0xf1, 0)
        sstore(0xf2, 0)
      }
    }

    return (done, offset);
  }
}
