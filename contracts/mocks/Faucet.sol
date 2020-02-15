pragma solidity ^0.5.2;

import './ERC20.sol';

contract Faucet {
  uint256 public constant drips = 1 ether;
  address[] public tokens;

  function sink (address addr) external {
    tokens.push(addr);
  }

  function drain () external {
    for (uint i = 0; i < tokens.length; i++) {
      address tkn = tokens[i];
      ERC20 token = ERC20(tkn);

      if (token.balanceOf(address(this)) >= drips) {
        token.transfer(msg.sender, drips);
      }
    }
  }
}
