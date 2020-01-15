pragma solidity ^0.5.2;

import './ERC20.sol';
import './ERC721.sol';
import './ERC1948.sol';
import './ERC1949.sol';


contract TestContract {
  address constant SPENDER_ADDR = 0xF3beAC30C498D9E26865F34fCAa57dBB935b0D74;

  event BlockBeacon();
  event TestEvent(address indexed addr, uint256 val);
  event TestEvent2(address indexed addr, uint256 indexed val);
  event TestEvent3(address indexed addr, uint256 indexed val, bool indexed);

  function test (address tokenAddr, address[] memory receivers, uint[] memory amounts) public {
    ERC20 token = ERC20(tokenAddr);
    ERC721 nft = ERC721(tokenAddr);

    for (uint i = 0; i < receivers.length; i++) {
      token.transfer(receivers[i], amounts[i]);
      token.balanceOf(receivers[i]);
      // transferFrom(from, to, tokenid)
      nft.balanceOf(receivers[i]);
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
    require(token.balanceOf(bob) == allowance);
    balance = token.balanceOf(address(this)) - 1;
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

  function testERC1948 (address tokenAddr, address /*alice*/, address /*bob*/, uint256 tokenId) public {
    ERC1948 token = ERC1948(tokenAddr);
    uint256 data = uint256(token.readData(tokenId)) + 1;
    token.writeData(tokenId, bytes32(data));
  }

  function testERC1949 (address tokenAddr, address /*alice*/, address bob, uint256 tokenId) public {
    ERC1949 token = ERC1949(tokenAddr);
    token.breed(tokenId, bob, bytes32(uint256(0x0a)));
  }

  function ping () public view returns (address) {
    return address(this);
  }
}
