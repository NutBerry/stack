pragma solidity ^0.5.2;

contract ERC20 {
  string public name = 'Wrapped Ether';
  string public symbol = 'WETH';
  uint8 public decimals = 18;

  event Approval(address indexed owner, address indexed spender, uint256 value);
  event Transfer(address indexed from, address indexed to, uint256 value);
  event Deposit(address indexed from, uint256 value);
  event Withdrawal(address indexed from, uint256 value);

  mapping (address => uint) public balanceOf;
  mapping (address => mapping (address => uint)) public allowance;

  function deposit () public payable {
    balanceOf[msg.sender] += msg.value;
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw (uint256 value) public {
    require(balanceOf[msg.sender] >= value);
    balanceOf[msg.sender] -= value;
    msg.sender.transfer(value);
    emit Withdrawal(msg.sender, value);
  }

  function totalSupply () public pure returns (uint) {
    return uint256(-1);
  }

  function approve (address spender, uint256 value) public returns (bool) {
    allowance[msg.sender][spender] = value;
    emit Approval(msg.sender, spender, value);
    return true;
  }

  function transfer (address to, uint256 value) public returns (bool) {
    return transferFrom(msg.sender, to, value);
  }

  function transferFrom (address from, address to, uint256 value) public returns (bool) {
    require(balanceOf[from] >= value);

    if (from != msg.sender && allowance[from][msg.sender] != uint(-1)) {
      require(allowance[from][msg.sender] >= value);
      allowance[from][msg.sender] -= value;
    }

    balanceOf[from] -= value;
    balanceOf[to] += value;

    emit Transfer(from, to, value);

    return true;
  }
}
