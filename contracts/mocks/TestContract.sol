pragma solidity ^0.5.2;

import './ERC20.sol';
import './ERC721.sol';


contract TestContract {
  address constant SPENDER_ADDR = 0xF3beAC30C498D9E26865F34fCAa57dBB935b0D74;

  mapping (address => uint256) public deposits;

  event BlockBeacon();
  event TestEvent(address indexed addr, uint256 val);
  event TestEvent2(address indexed addr, uint256 indexed val);
  event TestEvent3(address indexed addr, uint256 indexed val, bool indexed);

  function test (address tokenAddr, address[] memory receivers, uint[] memory amounts) public {
    ERC20 token = ERC20(tokenAddr);

    for (uint i = 0; i < receivers.length; i++) {
      token.transferFrom(receivers[i], receivers[i], amounts[i]);
      require(token.balanceOf(receivers[i]) >= amounts[i]);
    }
  }

  function testERC20 (address tokenAddr, address alice, address bob, uint256 /*value*/) public {
    ERC20 token = ERC20(tokenAddr);
    uint balance = token.balanceOf(alice);
    uint allowance = token.allowance(alice, address(this));
    require(balance > 0 && allowance > 0 && allowance <= balance);
    token.transferFrom(alice, bob, allowance);
    require(token.balanceOf(alice) == balance - allowance);
    require(token.allowance(alice, address(this)) == 0);
    require(token.balanceOf(bob) >= allowance);
    balance = allowance - 1;
    token.transfer(alice, balance);
    token.transfer(address(uint160(address(this)) - 1), 1);
    emit TestEvent(bob, balance);
    emit TestEvent2(bob, balance);
    emit TestEvent3(bob, balance, true);
    emit BlockBeacon();
  }

  function testERC721 (address tokenAddr, address alice, address bob, uint256 tokenId) public {
    ERC721 token = ERC721(tokenAddr);
    address owner = token.ownerOf(tokenId);
    require(owner == alice);
    require(token.getApproved(tokenId) == address(this));
    token.transferFrom(alice, bob, tokenId);
  }

  function storageLoad (uint256 key) public view returns (uint256) {
    assembly {
      mstore(0, sload(key))
      return(0, 32)
    }
  }

  function storageStore (uint256 key, uint256 value) public {
    assembly {
      sstore(key, value)
    }
  }

  function deposit (address addr, uint256 value, address other) public {
    require(address(this) == other);
    ERC20 token = ERC20(addr);
    token.transferFrom(msg.sender, address(this), value);
    deposits[msg.sender] += value;
  }

  function withdraw (address addr, address other) public {
    require(address(this) == other);
    ERC20 token = ERC20(addr);
    uint256 value = deposits[msg.sender];
    deposits[msg.sender] = 0;
    token.transfer(msg.sender, value + 1);
  }

  function ping () public view returns (address) {
    return address(this);
  }

  function testRipemd160 () public returns (bytes20) {
    bytes memory data = new bytes(128);
    return ripemd160(data);
  }

  function partialFail (address tokenAddr, address alice, address bob) public {
    ERC20 token = ERC20(tokenAddr);
    token.transferFrom(alice, bob, 1);
    uint256 balance = token.balanceOf(bob);
    emit TestEvent(bob, balance);
    emit TestEvent2(bob, balance);
    emit TestEvent3(bob, balance, true);
    emit BlockBeacon();
    if (msg.sender == alice) {
      revert();
    }
  }

  function balanceOf (address target, address owner) public returns (uint256) {
    ERC20 token = ERC20(target);
    return token.balanceOf(owner);
  }

  function allowance (address target, address owner, address spender) public returns (uint256) {
    ERC20 token = ERC20(target);
    return token.allowance(owner, spender);
  }

  function ownerOf (address target, uint256 tokenId) public returns (address) {
    ERC721 token = ERC721(target);
    return token.ownerOf(tokenId);
  }

  function getApproved (address target, uint256 tokenId) public returns (address) {
    ERC721 token = ERC721(target);
    return token.getApproved(tokenId);
  }

  function approve (address target, address spender, uint256 value) public {
    ERC20 token = ERC20(target);
    token.approve(spender, value);
  }

  function transfer (address target, address to, uint256 value) public {
    ERC20 token = ERC20(target);
    token.transfer(to, value);
  }

  function transferFrom (address target, address from, address to, uint256 value) public {
    ERC20 token = ERC20(target);
    token.transferFrom(from, to, value);
  }

  function submitBlock (address bridge) external payable {
    assembly {
      let size := sub(calldatasize(), 36)
      calldatacopy(0, 36, size)
      let success := call(gas(), bridge, callvalue(), 0, size, 0, 0)
      if iszero(success) {
        revert(0, 0)
      }
    }
  }
}
