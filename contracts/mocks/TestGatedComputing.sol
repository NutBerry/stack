pragma solidity ^0.6.2;

import '../LEVM.sol';

contract TestGatedComputing is LEVM {
  function addToken (address target, address owner, uint256 value) public {
    _setStorage(_hashERC20(target, owner), value);
  }

  function addAllowance (address target, address from, address spender, uint256 value) public {
    _setStorage(_hashAllowance(target, from, spender), value);
  }

  function addERC721 (address target, address owner, uint256 value) public {
    _setStorage(_hashERC721(target, value), uint256(owner));
  }

  function addApproval (address target, address spender, uint256 value) public {
    _setStorage(_hashApproval(target, value), uint256(spender));
  }

  function simple () public {
    uint256 val;
    assembly {
      function foo () {
        log0(0, 0)
      }
      foo()
      val := address()
    }
    if (val != 0) {
      revert();
    }

    assembly {
      mstore(0, address())
      return(0, 32)
    }
  }

  function testCall (address target, bytes memory callData) public {
    assembly {
      // TO
      sstore(0xf0, 0)
      // call the patched contract
      let success := callcode(gas(), target, 0, add(callData, 32), mload(callData), 0,  32)
      log1(0, 0, mload(0))
      log1(0, 0, success)
      return(0, 32)
    }
  }

  function callWithAddress (address target, bytes memory callData) public {
    assembly {
      // TO
      sstore(0xf0, address())
      // call the patched contract
      let success := callcode(gas(), target, 0, add(callData, 32), mload(callData), 0,  32)
      log1(0, 0, mload(0))
      log1(0, 0, success)
      return(0, 32)
    }
  }

  function deployAndCall (address gated, address target, bytes memory callData) public {
    assembly {
      // store our address to be used by the patched contract
      // TO
      sstore(0xf0, address())
      // FROM
      // sstore(0xf1, from)
    }

    bool success = _deployAndCall(gated, target, callData);
    assembly {
      log1(0, 0, success)
    }
  }

  function BALANCE () public {
    assembly {
      let val := balance(address())
      log1(0, 0, val)
    }
  }

  function GASPRICE () public {
    assembly {
      let val := gasprice()
      log1(0, 0, val)
    }
  }

  function EXTCODECOPY () public {
    assembly {
      extcodecopy(address(), 0, 0, 32)
      log1(0, 0, mload(0))
    }
  }

  function EXTCODEHASH () public {
    assembly {
      let val := extcodehash(address())
      log1(0, 0, val)
    }
  }

  function BLOCKHASH () public {
    assembly {
      let val := blockhash(1)
      log1(0, 0, val)
    }
  }

  function COINBASE () public {
    assembly {
      let val := coinbase()
      log1(0, 0, val)
    }
  }

  function TIMESTAMP () public {
    assembly {
      let val := timestamp()
      log1(0, 0, val)
    }
  }

  function NUMBER () public {
    assembly {
      let val := number()
      log1(0, 0, val)
    }
  }

  function DIFFICULTY () public {
    assembly {
      let val := difficulty()
      log1(0, 0, val)
    }
  }

  function GASLIMIT () public {
    assembly {
      let val := gaslimit()
      log1(0, 0, val)
    }
  }

  function SLOAD () public {
    assembly {
      let val := sload(0)
      log1(0, 0, val)
    }
  }

  function SSTORE () public {
    assembly {
      sstore(0, 1)
      log1(0, 0, 1)
    }
  }

  function CREATE () public {
    assembly {
      let val := create(0, 0, 1)
      log1(0, 0, val)
    }
  }

  function CALLCODE () public {
    assembly {
      let val := callcode(gas(), address(), 0, 0, 1, 0, 1)
      log1(0, 0, val)
    }
  }

  function DELEGATECALL () public {
    assembly {
      let val := delegatecall(gas(), address(), 0, 1, 0, 1)
      log1(0, 0, val)
    }
  }

  function CREATE2 () public {
    assembly {
      let val := create2(0, 0, 0, 1)
      log1(0, 0, val)
    }
  }

  function SELFDESTRUCT () public {
    assembly {
      selfdestruct(0)
      log1(0, 0, 1)
    }
  }

  function doSTATICCALL (address tgt, bytes calldata) external {
    assembly {
      calldatacopy(0, 0, calldatasize())
      let success := staticcall(gas(), tgt, 100, mload(68), 0, 32)
      if or( iszero(returndatasize()), iszero(success) ) {
        revert(0, 0)
      }
    }
  }
}
