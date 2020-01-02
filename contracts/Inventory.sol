pragma solidity ^0.5.2;

import './InventoryStorage.sol';


contract Inventory is InventoryStorage {

  function _balanceOf (
    address target,
    address owner
  ) internal view returns (uint256) {
    uint256 val = getERC20(target, owner);

    return val;
  }

  function _allowance (
    address target,
    address owner,
    address spender
  ) internal view returns (uint256) {
    uint256 val = getAllowance(target, owner, spender);

    return val;
  }

  function _transfer (
    address msgSender,
    address target,
    address to,
    uint256 value
  ) internal returns (bool) {
    uint256 senderValue = getERC20(target, msgSender);

    //if (isERC20) {
    if (true) {
      uint256 has = senderValue;
      uint256 want = value;
      // not enough
      if (has < want || want == 0) {
        return false;
      }

      senderValue = has - want;
      setERC20(target, msgSender, senderValue);

      if (to != address(0)) {
        // now update `to`
        uint256 receiverValue = getERC20(target, to) + want;
        setERC20(target, to, receiverValue);
      } else {
        incrementExit(target, msgSender, want);
      }

      return true;
    }

    return false;
  }

  function _transferFrom (
    address msgSender,
    address target,
    address from,
    address to,
    uint256 tokenId
  ) internal returns (bool) {
    uint256 senderValue;

    //if (isERC20) {
    if (true) {
      uint256 allowed = getAllowance(target, from, msgSender);
      if (from == address(0)) {
        senderValue = allowed;
      } else {
        senderValue = getERC20(target, from);
      }

      uint256 has = senderValue;
      uint256 want = tokenId;

      // not enough
      if (has < want || (want > allowed && from != msgSender) || want == 0) {
        return false;
      }

      if (from != msgSender) {
        setAllowance(target, from, msgSender, allowed - want);
      }
      senderValue = has - want;
      setERC20(target, from, senderValue);

      if (to != address(0)) {
        // now update `to`
        uint256 receiverValue = getERC20(target, to) + want;

        setERC20(target, to, receiverValue);
      } else {
        incrementExit(target, from, want);
      }

      return true;
    }

    return false;
  }
}
