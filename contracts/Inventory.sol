pragma solidity ^0.5.2;

import './InventoryStorage.sol';


contract Inventory is InventoryStorage {

  function balanceOf (
    address target,
    address owner
  ) internal returns (bytes memory) {
    uint256 val = getERC20(target, owner);

    return abi.encodePacked(val);
  }

  function allowance (
    address target,
    address owner,
    address spender
  ) internal returns (bytes memory) {
    uint256 val = getAllowance(target, owner, spender);

    return abi.encodePacked(val);
  }

  function transfer (
    address msgSender,
    address target,
    address to,
    uint256 value
  ) internal returns (bytes memory) {
    uint256 senderValue = getERC20(target, msgSender);

    //if (isERC20) {
    if (true) {
      uint256 has = senderValue;
      uint256 want = value;
      // not enough
      if (has < want || want == 0) {
        return '';
      }

      senderValue = has - want;
      setERC20(target, msgSender, senderValue);

      if (to != address(this)) {
        // now update `to`
        uint256 receiverValue = getERC20(target, to) + want;
        setERC20(target, to, receiverValue);
      } else {
        incrementExit(target, msgSender, want);
      }

      return abi.encodePacked(true);
    }

    return '';
  }

  function transferFrom (
    address msgSender,
    address target,
    address from,
    address to,
    uint256 tokenId
  ) internal returns (bytes memory) {
    uint256 senderValue;

    //if (isERC20) {
    if (true) {
      uint256 allowance = getAllowance(target, from, msgSender);
      if (from == address(this)) {
        senderValue = allowance;
      } else {
        senderValue = getERC20(target, from);
      }

      uint256 has = senderValue;
      uint256 want = tokenId;

      // not enough
      if (has < want || (want > allowance && from != msgSender) || want == 0) {
        return '';
      }

      if (from != msgSender) {
        setAllowance(target, from, msgSender, allowance - want);
      }
      senderValue = has - want;
      setERC20(target, from, senderValue);

      if (to != address(this)) {
        // now update `to`
        uint256 receiverValue = getERC20(target, to) + want;

        setERC20(target, to, receiverValue);
      } else {
        incrementExit(target, from, want);
      }

      return abi.encodePacked(true);
    }

    return '';
  }
}
