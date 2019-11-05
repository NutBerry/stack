

contract TestGatedComputing {
  function () external {
    uint256 val;
    assembly {
      function foo () {
      }

      val := address()
      foo()
    }
    if (val != 0) {
      revert();
    }

    assembly {
      mstore(0, address())
      return(0, 32)
    }
  }
}
