pragma solidity ^0.6.2;

import './ERC20.sol';

contract TestERC20 is ERC20 {
  bool _ret;
  bool _lock;
  address _owner;

  constructor () public {
    _owner = msg.sender;
    _ret = true;
    balanceOf[msg.sender] = uint256(-1);
  }

  function transferFrom (address from, address to, uint256 value) override public returns (bool) {
    if (_lock) {
      revert();
    }

    super.transferFrom(from, to, value);

    return _ret;
  }

  function ret (bool v) public {
    require(msg.sender == _owner);
    _ret = v;
  }

  function lock (bool v) public {
    require(msg.sender == _owner);
    _lock = v;
  }
}
