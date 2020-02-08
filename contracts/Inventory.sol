pragma solidity ^0.5.2;

import './InventoryStorage.sol';


contract Inventory is InventoryStorage {

  function _balanceOf (
    address target,
    address owner
  ) internal view returns (uint256) {
    return _getStorage(_hashERC20(target, owner));
  }

  function _allowance (
    address target,
    address owner,
    address spender
  ) internal view returns (uint256) {
    return _getStorage(_hashAllowance(target, owner, spender));
  }

  function _approve (
    address from,
    address to,
    address spender,
    uint256 value
  ) internal returns (uint256) {
    bytes32 nftKey = _hashERC721(to, value);
    uint256 tokenOwner = _getStorage(nftKey);

    if (tokenOwner != 0) {
      // ERC721
      if (uint256(from) != tokenOwner) {
        return 0;
      }
      bytes32 key = _hashApproval(to, value);
      _setStorage(key, uint256(spender));
    } else {
      // ERC20
      _setStorage(_hashAllowance(to, from, spender), value);
    }

    return 1;
  }

  function _transfer (
    address msgSender,
    address target,
    address to,
    uint256 value
  ) internal returns (uint256) {
    bytes32 senderKey = _hashERC20(target, msgSender);
    uint256 senderValue = _getStorage(senderKey);
    // not enough
    if (senderValue < value || value == 0) {
      return 0;
    }

    _setStorage(senderKey, senderValue - value);

    if (to == address(0)) {
      _incrementExit(target, msgSender, value);
    } else {
      // now update `to`
      bytes32 receiverKey = _hashERC20(target, to);
      uint256 receiverValue = _getStorage(receiverKey) + value;
      _setStorage(receiverKey, receiverValue);
    }

    return 1;
  }

  function _transferFrom (
    address msgSender,
    address target,
    address from,
    address to,
    uint256 value
  ) internal returns (uint256) {
    bytes32 nftKey = _hashERC721(target, value);
    uint256 tokenOwner = _getStorage(nftKey);

    if (tokenOwner == 0) {
      // we assume ERC20
      bytes32 senderKey = _hashERC20(target, from);
      bytes32 allowanceKey = _hashAllowance(target, from, msgSender);
      uint256 allowance = _getStorage(allowanceKey);
      uint256 senderValue = _getStorage(senderKey);

      // not enough balance or not approved ?
      if (senderValue < value || (value > allowance && from != msgSender) || value == 0) {
        return 0;
      }

      if (from != msgSender && allowance != uint256(-1)) {
        _setStorage(allowanceKey, allowance - value);
      }

      _setStorage(senderKey, senderValue - value);

      // now update `to`
      bytes32 receiverKey = _hashERC20(target, to);
      uint256 receiverValue = _getStorage(receiverKey) + value;
      _setStorage(receiverKey, receiverValue);

      return 1;
    }

    // ERC721
    {
      bytes32 apr = _hashApproval(target, value);
      if (tokenOwner != uint256(msgSender)) {
        uint256 approved = _getStorage(apr);
        if (approved != uint256(msgSender)) {
          return 0;
        }
      }
      _setStorage(apr, 0);

      _setStorage(nftKey, uint256(to));
      if (to == address(0)) {
        _setERC721Exit(target, from, value);
      }
      return 1;
    }
  }
}
