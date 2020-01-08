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
    //if (isERC20) {
    if (true) {
      uint256 senderValue = getERC20(target, msgSender);
      // not enough
      if (senderValue < value || value == 0) {
        return false;
      }

      senderValue -= value;
      setERC20(target, msgSender, senderValue);

      if (to == address(0)) {
        incrementExit(target, msgSender, value);
      } else {
        // now update `to`
        uint256 receiverValue = getERC20(target, to) + value;
        setERC20(target, to, receiverValue);
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
    uint256 value
  ) internal returns (bool) {

    //if (isERC20) {
    if (true) {
      uint256 allowed = getAllowance(target, from, msgSender);
      uint256 senderValue = getERC20(target, from);

      // not enough
      if (senderValue < value || (value > allowed && from != msgSender) || value == 0) {
        return false;
      }

      if (from != msgSender) {
        setAllowance(target, from, msgSender, allowed - value);
      }
      senderValue -= value;
      setERC20(target, from, senderValue);

      // now update `to`
      uint256 receiverValue = getERC20(target, to) + value;
      setERC20(target, to, receiverValue);

      return true;
    }

    return false;
  }
}
